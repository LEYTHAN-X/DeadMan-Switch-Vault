/**
 * gmail.service.js
 * Core service for all Gmail OAuth 2.0 operations and email delivery.
 *
 * Responsibilities:
 *  - Build the Google OAuth2 client (singleton)
 *  - Generate the authorization URL for the OAuth consent screen
 *  - Exchange authorization codes for tokens
 *  - Encrypt and store tokens in GmailConnection model
 *  - Automatically refresh expired access tokens
 *  - Compose and send MIME emails via Gmail API
 *  - Revoke tokens and disconnect a Gmail account
 *  - Create secure, time-limited download tokens for large file attachments
 *
 * Security notes:
 *  - Tokens are NEVER stored in plaintext — always encrypted with AES-256-GCM
 *  - Tokens are NEVER logged
 *  - Access is always verified against the authenticated user's userId
 */

const { google } = require('googleapis');
const GmailConnection = require('../../models/GmailConnection');
const encryptionService = require('../encryption/encryption.service');
const logger = require('../../utils/logger');
const crypto = require('crypto');

// ─── OAuth2 Client Factory ────────────────────────────────────────────────────

/**
 * Creates and returns a configured Google OAuth2 client.
 * Uses credentials from environment variables.
 */
function createOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      'Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env'
    );
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// ─── Authorization URL ────────────────────────────────────────────────────────

/**
 * Generates the Google OAuth2 consent screen URL.
 * Uses offline access_type to receive a refresh token.
 * Uses "consent" prompt to always show the consent screen (ensures refresh token is returned).
 *
 * @param {string} userId - Used to generate a CSRF state token
 * @returns {{ url: string, state: string }}
 */
function generateAuthUrl(userId) {
  const oauth2Client = createOAuth2Client();

  // State token: HMAC of userId to verify callback authenticity
  const state = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dms-state-secret')
    .update(userId.toString())
    .digest('hex');

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  });

  return { url, state };
}

/**
 * Verifies a callback state token to prevent CSRF attacks.
 *
 * @param {string} userId
 * @param {string} receivedState
 * @returns {boolean}
 */
function verifyState(userId, receivedState) {
  const expectedState = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dms-state-secret')
    .update(userId.toString())
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expectedState, 'hex'),
    Buffer.from(receivedState, 'hex')
  );
}

// ─── Token Exchange & Storage ─────────────────────────────────────────────────

/**
 * Exchanges an authorization code for OAuth tokens.
 * Retrieves the user's Gmail address.
 * Encrypts and stores tokens in GmailConnection.
 *
 * @param {string} userId - The authenticated user's _id
 * @param {string} code   - Authorization code from Google callback
 * @param {string} state  - State token from Google callback (for CSRF verification)
 * @returns {Promise<object>} Safe connection object (no tokens)
 */
async function exchangeCodeAndSave(userId, code, state) {
  // 1. Verify CSRF state
  if (!verifyState(userId, state)) {
    const err = new Error('Invalid OAuth state parameter. Possible CSRF attack.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Exchange code for tokens
  const oauth2Client = createOAuth2Client();
  let tokens;
  try {
    const response = await oauth2Client.getToken(code);
    tokens = response.tokens;
  } catch (googleErr) {
    logger.error('Gmail token exchange failed', { userId, error: googleErr.message });
    const err = new Error('Failed to exchange authorization code with Google. The code may have expired.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate that we received a refresh token
  if (!tokens.refresh_token) {
    const err = new Error(
      'Google did not return a refresh token. Please revoke app access in your Google Account and try again.'
    );
    err.statusCode = 400;
    throw err;
  }

  // 3.5. Validate that the send scope was explicitly granted by the user
  const grantedScopes = tokens.scope ? tokens.scope.split(' ') : [];
  const hasSendScope = grantedScopes.some((s) => s.includes('gmail.send') || s.includes('mail.google.com'));
  if (!hasSendScope) {
    const err = new Error(
      'The "Send email on your behalf" permission was not checked on Google\'s consent screen. Please reconnect and check the box.'
    );
    err.statusCode = 400;
    throw err;
  }

  // 4. Get the Gmail address using the access token
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  let gmailAddress;
  try {
    const userInfo = await oauth2.userinfo.get();
    gmailAddress = userInfo.data.email;
  } catch (infoErr) {
    logger.error('Failed to fetch Gmail user info', { userId, error: infoErr.message });
    const err = new Error('Connected to Google but could not retrieve your Gmail address.');
    err.statusCode = 500;
    throw err;
  }

  // 5. Encrypt both tokens
  const encryptedAccessToken = encryptionService.encryptField(tokens.access_token);
  const encryptedRefreshToken = encryptionService.encryptField(tokens.refresh_token);

  // 6. Upsert GmailConnection (one per user)
  const connection = await GmailConnection.findOneAndUpdate(
    { userId },
    {
      userId,
      gmailAddress,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiryAt: new Date(tokens.expiry_date),
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      status: 'connected',
      lastRefreshedAt: new Date(),
      lastError: null,
    },
    { upsert: true, new: true, runValidators: true }
  );

  logger.info('Gmail account connected', { userId, gmailAddress });

  return connection.toSafeObject();
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Builds a fully-authenticated OAuth2 client for a user.
 * Automatically refreshes the access token if expired.
 *
 * @param {string} userId
 * @returns {Promise<{ oauth2Client: OAuth2Client, connection: GmailConnection }>}
 */
async function getAuthenticatedClient(userId) {
  // Load connection with tokens (select: false fields)
  const connection = await GmailConnection.findOne({ userId }).select(
    '+encryptedAccessToken +encryptedRefreshToken'
  );

  if (!connection) {
    const err = new Error('No Gmail account connected. Please connect your Gmail account first.');
    err.statusCode = 400;
    throw err;
  }

  if (connection.status === 'revoked') {
    const err = new Error('Gmail connection has been revoked. Please reconnect your Gmail account.');
    err.statusCode = 400;
    throw err;
  }

  // Decrypt tokens
  const accessToken = encryptionService.decryptField(connection.encryptedAccessToken);
  const refreshToken = encryptionService.decryptField(connection.encryptedRefreshToken);

  // Build OAuth2 client with credentials
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: connection.tokenExpiryAt?.getTime(),
  });

  // Auto-refresh if access token is expired or will expire in <5 minutes
  const expiresIn = connection.tokenExpiryAt
    ? connection.tokenExpiryAt.getTime() - Date.now()
    : 0;

  if (expiresIn < 5 * 60 * 1000) {
    try {
      const { credentials: newTokens } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newTokens);

      // Encrypt and persist new access token
      const encryptedAccessToken = encryptionService.encryptField(newTokens.access_token);

      const updatePayload = {
        encryptedAccessToken,
        tokenExpiryAt: new Date(newTokens.expiry_date),
        lastRefreshedAt: new Date(),
        status: 'connected',
        lastError: null,
      };

      // Persist new refresh token only if Google returned one
      if (newTokens.refresh_token) {
        updatePayload.encryptedRefreshToken = encryptionService.encryptField(newTokens.refresh_token);
      }

      await GmailConnection.findOneAndUpdate({ userId }, updatePayload);
      logger.info('Gmail access token refreshed', { userId });
    } catch (refreshErr) {
      // Mark connection as errored
      await GmailConnection.findOneAndUpdate(
        { userId },
        { status: 'token_expired', lastError: refreshErr.message }
      );
      logger.error('Gmail token refresh failed', { userId, error: refreshErr.message });
      const err = new Error('Gmail session expired and could not be refreshed. Please reconnect your Gmail account.');
      err.statusCode = 401;
      throw err;
    }
  }

  return { oauth2Client, connection };
}

// ─── Email Delivery ───────────────────────────────────────────────────────────

/**
 * Builds a base64-encoded MIME email message (HTML only, no attachments).
 *
 * @param {object} opts
 * @param {string} opts.from        - Sender (e.g. "Name <email@gmail.com>")
 * @param {string} opts.to          - Recipient email
 * @param {string} opts.subject     - Email subject
 * @param {string} opts.htmlBody    - HTML content
 * @param {string} [opts.textBody]  - Plain text fallback
 * @returns {string} Raw base64url-encoded MIME message
 */
function buildMimeMessage({ from, to, subject, htmlBody, textBody }) {
  const boundary = `dms_${crypto.randomBytes(16).toString('hex')}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n');

  const plainPart = textBody
    ? [
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        textBody,
      ].join('\r\n')
    : '';

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].join('\r\n');

  const closing = `--${boundary}--`;

  const raw = [headers, '', plainPart, htmlPart, closing].join('\r\n');

  // Gmail API requires base64url encoding
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Builds a base64-encoded MIME email with one binary file attachment.
 *
 * Uses multipart/mixed so the HTML body and the attachment are both delivered.
 *
 * @param {object} opts
 * @param {string} opts.from             - Sender address
 * @param {string} opts.to               - Recipient address
 * @param {string} opts.subject          - Email subject
 * @param {string} opts.htmlBody         - HTML body
 * @param {Buffer} opts.attachmentBuffer - Decrypted file bytes
 * @param {string} opts.attachmentName   - Filename shown in email (e.g. "report.pdf")
 * @param {string} opts.attachmentMime   - MIME type (e.g. "application/pdf")
 * @returns {string} Raw base64url-encoded MIME message
 */
function buildMimeMessageWithAttachment({
  from,
  to,
  subject,
  htmlBody,
  attachmentBuffer,
  attachmentName,
  attachmentMime,
}) {
  const outerBoundary = `dms_outer_${crypto.randomBytes(12).toString('hex')}`;
  const innerBoundary = `dms_inner_${crypto.randomBytes(12).toString('hex')}`;

  // Encode attachment as base64, split into 76-char lines (RFC 2045)
  const attachmentBase64 = attachmentBuffer
    .toString('base64')
    .match(/.{1,76}/g)
    .join('\r\n');

  // Safe filename for Content-Disposition header
  const safeFilename = attachmentName.replace(/[^\w.\-]/g, '_');

  const lines = [
    // Outer headers — multipart/mixed wraps body + attachment
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    ``,
    // --- Body part (multipart/alternative for plain+html)
    `--${outerBoundary}`,
    `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
    ``,
    `--${innerBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    `Authorized Evidence Release from Dead Man's Switch Vault.\r\nPlease open the attached document.`,
    ``,
    `--${innerBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    ``,
    `--${innerBoundary}--`,
    ``,
    // --- Attachment part
    `--${outerBoundary}`,
    `Content-Type: ${attachmentMime}; name="${safeFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    ``,
    attachmentBase64,
    ``,
    `--${outerBoundary}--`,
  ];

  const raw = lines.join('\r\n');

  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email via Gmail API using the user's authorized Gmail account.
 *
 * @param {string} userId     - Authenticated user's _id
 * @param {object} emailOpts  - { to, subject, htmlBody, textBody }
 * @returns {Promise<{ messageId: string, threadId: string }>}
 */
async function sendEmail(userId, { to, subject, htmlBody, textBody }) {
  const { oauth2Client, connection } = await getAuthenticatedClient(userId);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const rawMessage = buildMimeMessage({
    from: `Dead Man's Switch <${connection.gmailAddress}>`,
    to,
    subject,
    htmlBody,
    textBody: textBody || subject,
  });

  let result;
  try {
    result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });
  } catch (sendErr) {
    // Update connection status if we got an auth error
    if (sendErr.code === 401 || sendErr.code === 403) {
      await GmailConnection.findOneAndUpdate(
        { userId: connection.userId },
        { status: 'token_expired', lastError: 'Auth failure during send' }
      );
    }
    logger.error('Gmail send failed', { userId, to, error: sendErr.message });
    throw sendErr;
  }

  // Update usage stats
  await GmailConnection.findOneAndUpdate(
    { userId: connection.userId },
    {
      $inc: { emailsSentCount: 1 },
      lastUsedAt: new Date(),
    }
  );

  logger.info('Email sent via Gmail API', {
    userId,
    to,
    subject,
    messageId: result.data.id,
  });

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
  };
}

// ─── Send Email With Attachment ───────────────────────────────────────────────

/**
 * Sends an email with a single binary file attachment via the Gmail API.
 *
 * @param {string} userId
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.htmlBody
 * @param {Buffer} opts.attachmentBuffer  - Decrypted file bytes
 * @param {string} opts.attachmentName    - Filename for the attachment
 * @param {string} opts.attachmentMime    - MIME type of the file
 * @returns {Promise<{ messageId: string, threadId: string }>}
 */
async function sendEmailWithAttachment(
  userId,
  { to, subject, htmlBody, attachmentBuffer, attachmentName, attachmentMime }
) {
  const { oauth2Client, connection } = await getAuthenticatedClient(userId);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const rawMessage = buildMimeMessageWithAttachment({
    from: `Dead Man's Switch <${connection.gmailAddress}>`,
    to,
    subject,
    htmlBody,
    attachmentBuffer,
    attachmentName,
    attachmentMime,
  });

  let result;
  try {
    result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
      // Allow larger payloads for file attachments (up to 35 MB per Gmail API limit)
      uploadType: 'multipart',
    });
  } catch (sendErr) {
    if (sendErr.code === 401 || sendErr.code === 403) {
      await GmailConnection.findOneAndUpdate(
        { userId: connection.userId },
        { status: 'token_expired', lastError: 'Auth failure during send' }
      );
    }
    logger.error('Gmail send-with-attachment failed', { userId, to, error: sendErr.message });
    throw sendErr;
  }

  // Update usage stats
  await GmailConnection.findOneAndUpdate(
    { userId: connection.userId },
    {
      $inc: { emailsSentCount: 1 },
      lastUsedAt: new Date(),
    }
  );

  logger.info('Email with attachment sent via Gmail API', {
    userId,
    to,
    subject,
    attachmentName,
    messageId: result.data.id,
  });

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
  };
}

// ─── Send Test Email ──────────────────────────────────────────────────────────

/**
 * Sends a verification/test email to confirm Gmail integration is working.
 *
 * @param {string} userId
 * @param {string} recipientEmail
 * @param {string} [customSubject]
 * @param {string} [customMessage]
 */
async function sendTestEmail(userId, recipientEmail, customSubject, customMessage) {
  const subject = customSubject || "Dead Man's Switch — Gmail Integration Verified ✓";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #07090e; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #0b0f17; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0b0f17 0%, #0f172a 100%); border-bottom: 1px solid #06b6d4; padding: 32px; text-align: center; }
        .header h1 { color: #06b6d4; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.05em; }
        .header p { color: #94a3b8; margin: 8px 0 0; font-size: 13px; }
        .body { padding: 32px; }
        .status-badge { display: inline-block; background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #10b981; padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
        .message { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; font-size: 15px; }
        .footer { border-top: 1px solid #1e293b; padding: 20px 32px; text-align: center; color: #475569; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Dead Man's Switch</h1>
          <p>Secure Evidence Vault & Emergency Notification System</p>
        </div>
        <div class="body">
          <div class="status-badge">✓ Gmail Integration Active</div>
          <p class="message">
            ${customMessage || 'This is a test email confirming that your Gmail account has been successfully connected to your Dead Man\'s Switch vault. Your Gmail account is authorized and ready to deliver emergency notifications to your designated recipients.'}
          </p>
          <p class="message" style="font-size:13px; color:#64748b;">
            This email was sent using the Gmail API via your own authorized account. 
            Your credentials are encrypted and stored securely. 
            We will never use your Gmail account for any purpose other than sending your authorized emergency notifications.
          </p>
        </div>
        <div class="footer">
          Dead Man's Switch &bull; Secure • Private • Yours &bull; ${new Date().toUTCString()}
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(userId, { to: recipientEmail, subject, htmlBody });
}

// ─── Disconnect / Revoke ──────────────────────────────────────────────────────

/**
 * Revokes the OAuth token with Google and removes the connection from DB.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function disconnectGmail(userId) {
  const connection = await GmailConnection.findOne({ userId }).select(
    '+encryptedAccessToken +encryptedRefreshToken'
  );

  if (!connection) {
    const err = new Error('No Gmail connection found.');
    err.statusCode = 404;
    throw err;
  }

  // Best-effort: attempt to revoke the token with Google
  try {
    const accessToken = encryptionService.decryptField(connection.encryptedAccessToken);
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    await oauth2Client.revokeToken(accessToken);
    logger.info('Gmail token revoked with Google', { userId });
  } catch (revokeErr) {
    // Log but do not fail — still delete the local record
    logger.warn('Gmail token revocation with Google failed (continuing with local deletion)', {
      userId,
      error: revokeErr.message,
    });
  }

  await GmailConnection.deleteOne({ userId });
  logger.info('Gmail connection removed', { userId });
}

// ─── Status Check ─────────────────────────────────────────────────────────────

/**
 * Returns the current Gmail connection status for a user (no tokens).
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getConnectionStatus(userId) {
  const connection = await GmailConnection.findOne({ userId });
  return connection ? connection.toSafeObject() : null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  generateAuthUrl,
  verifyState,
  exchangeCodeAndSave,
  getAuthenticatedClient,
  sendEmail,
  sendEmailWithAttachment,
  sendTestEmail,
  disconnectGmail,
  getConnectionStatus,
  buildMimeMessage,
  buildMimeMessageWithAttachment,
};

