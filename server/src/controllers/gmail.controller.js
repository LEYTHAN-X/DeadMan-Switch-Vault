/**
 * gmail.controller.js
 * HTTP handlers for all Gmail-related endpoints.
 * Controllers are thin — all business logic lives in gmail.service.js.
 */

const gmailService = require('../services/gmail/gmail.service');
const { sendTestEmailSchema } = require('../validators/gmail.validator');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

// ─── Helper: Audit logger ─────────────────────────────────────────────────────

async function audit(userId, action, meta = {}) {
  try {
    await AuditLog.create({ userId, action, metadata: meta, ipAddress: meta.ip || 'unknown' });
  } catch (e) {
    logger.error('Audit log write failed', { action, error: e.message });
  }
}

// ─── GET /api/gmail/status ────────────────────────────────────────────────────

/**
 * Returns the current Gmail connection status for the authenticated user.
 * No tokens are returned — only safe metadata.
 */
const getStatus = async (req, res, next) => {
  try {
    const connection = await gmailService.getConnectionStatus(req.user._id);

    if (!connection) {
      return res.status(200).json({
        success: true,
        connected: false,
        connection: null,
        message: 'No Gmail account connected.',
      });
    }

    return res.status(200).json({
      success: true,
      connected: true,
      connection,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/gmail/connect ───────────────────────────────────────────────────

/**
 * Generates the Google OAuth2 consent screen URL and returns it to the frontend.
 * The frontend should redirect the user to this URL.
 */
const initiateOAuth = async (req, res, next) => {
  try {
    const { url, state } = gmailService.generateAuthUrl(req.user._id);

    logger.info('Gmail OAuth initiated', { userId: req.user._id });

    return res.status(200).json({
      success: true,
      authUrl: url,
      state,
      message: 'Redirect the user to authUrl to begin Gmail OAuth.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/gmail/oauth2callback ───────────────────────────────────────────

/**
 * Google OAuth2 callback handler.
 * Called by Google after the user grants (or denies) permission.
 * Exchanges the authorization code for tokens and stores them encrypted.
 *
 * NOTE: This endpoint is hit by the browser directly (browser redirect from Google).
 * We close the popup/redirect to the frontend success page after storing tokens.
 *
 * Authentication is verified via the state parameter (HMAC of userId from JWT stored
 * in the OAuth initiation step). The userId is encoded in the state.
 *
 * To map state → userId without a session, we store the state in the user's DB record
 * during initiation. Here we validate from a JWT sent as a query param or use a
 * simpler approach: re-derive userId from their JWT cookie / Authorization header.
 *
 * Implementation: We require the user to send their JWT as the `jwt` query param
 * during OAuth initiation (the frontend appends it). This avoids server-side session storage.
 */
const handleOAuthCallback = async (req, res, next) => {
  try {
    const { code, state, error: googleError } = req.query;

    // Handle user denial
    if (googleError) {
      logger.warn('Gmail OAuth denied by user', { error: googleError });
      return res.redirect(
        `${process.env.CLIENT_URL}/gmail?status=denied&message=${encodeURIComponent('Gmail authorization was cancelled.')}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${process.env.CLIENT_URL}/gmail?status=error&message=${encodeURIComponent('Missing OAuth parameters from Google.')}`
      );
    }

    // Retrieve userId from the pending OAuth state stored in DB
    // (The frontend passes its JWT as ?userToken=... during initiation)
    // We stored the userId→state mapping in the oauth_states collection
    // For simplicity: decode it from the pending state token stored in User record
    const OAuthPendingState = require('../models/OAuthPendingState');
    const pendingRecord = await OAuthPendingState.findOne({ state });

    if (!pendingRecord) {
      logger.warn('OAuth callback received unknown state', { state: state.slice(0, 16) + '...' });
      return res.redirect(
        `${process.env.CLIENT_URL}/gmail?status=error&message=${encodeURIComponent('OAuth session expired or invalid. Please try again.')}`
      );
    }

    const userId = pendingRecord.userId;

    // Exchange code for tokens
    const connection = await gmailService.exchangeCodeAndSave(userId, code, state);

    // Clean up pending state
    await OAuthPendingState.deleteOne({ _id: pendingRecord._id });

    // Audit log
    await audit(userId, 'GMAIL_CONNECTED', {
      gmailAddress: connection.gmailAddress,
      ip: req.ip,
    });

    // Redirect to frontend success page
    return res.redirect(
      `${process.env.CLIENT_URL}/gmail?status=success&email=${encodeURIComponent(connection.gmailAddress)}`
    );
  } catch (err) {
    logger.error('Gmail OAuth callback error', { error: err.message });
    return res.redirect(
      `${process.env.CLIENT_URL}/gmail?status=error&message=${encodeURIComponent(err.message)}`
    );
  }
};

// ─── POST /api/gmail/initiate-connect ────────────────────────────────────────

/**
 * Stores a pending OAuth state record so we can look up userId in the callback.
 * Returns the authUrl for the frontend to redirect to.
 */
const initiateConnect = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { url, state } = gmailService.generateAuthUrl(userId);

    // Store state → userId mapping (expires in 10 minutes)
    const OAuthPendingState = require('../models/OAuthPendingState');
    await OAuthPendingState.findOneAndUpdate(
      { userId },
      { userId, state, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      { upsert: true, new: true }
    );

    logger.info('Gmail OAuth connect initiated, state stored', { userId });

    return res.status(200).json({
      success: true,
      authUrl: url,
      message: 'Redirect to authUrl to authorize Gmail access.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/gmail/send-test ────────────────────────────────────────────────

/**
 * Sends a test email via the user's connected Gmail account.
 * Used to verify the integration is working correctly.
 */
const sendTestEmail = async (req, res, next) => {
  try {
    // Validate request body
    const parsed = sendTestEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error(parsed.error.errors[0]?.message || 'Invalid request body');
      err.statusCode = 422;
      throw err;
    }

    const { recipientEmail, subject, message } = parsed.data;
    const userId = req.user._id;

    const result = await gmailService.sendTestEmail(userId, recipientEmail, subject, message);

    // Audit
    await audit(userId, 'GMAIL_TEST_EMAIL_SENT', {
      to: recipientEmail,
      messageId: result.messageId,
      ip: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${recipientEmail}`,
      messageId: result.messageId,
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/gmail/disconnect ────────────────────────────────────────────

/**
 * Revokes Gmail authorization and removes the connection from the database.
 */
const disconnect = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get gmail address before deletion for audit
    const statusBefore = await gmailService.getConnectionStatus(userId);

    await gmailService.disconnectGmail(userId);

    // Audit
    await audit(userId, 'GMAIL_DISCONNECTED', {
      gmailAddress: statusBefore?.gmailAddress || 'unknown',
      ip: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Gmail account disconnected and tokens revoked successfully.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStatus,
  initiateOAuth,
  initiateConnect,
  handleOAuthCallback,
  sendTestEmail,
  disconnect,
};

