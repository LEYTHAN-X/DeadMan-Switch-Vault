/**
 * verify-phase6.js
 * End-to-end verification test suite for Phase 6: Gmail Integration & OAuth 2.0 Security.
 * Uses native Node http module on dedicated test port 5006.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../src/app');
const User = require('../src/models/User');
const GmailConnection = require('../src/models/GmailConnection');
const OAuthPendingState = require('../src/models/OAuthPendingState');
const AuditLog = require('../src/models/AuditLog');
const encryptionService = require('../src/services/encryption/encryption.service');
const gmailService = require('../src/services/gmail/gmail.service');

const TEST_PORT = 5006;
const TEST_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/deadman_switch';

const PASS = '\x1b[32m✔ PASS\x1b[0m';
const FAIL = '\x1b[31m✖ FAIL\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${PASS} - ${message}`);
    passed++;
  } else {
    console.error(`  ${FAIL} - ${message}`);
    failed++;
  }
}

// Native HTTP helper
function apiRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   PHASE 6 VERIFICATION: GMAIL OAUTH 2.0 INTEGRATION');
  console.log('======================================================\n');

  let server;

  try {
    await mongoose.connect(TEST_MONGO_URI);
    console.log('[*] Connected to MongoDB for test suite.');

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`[*] Ephemeral test server listening on port ${TEST_PORT}.\n`);

    // Clean up test data
    const testEmail = `phase6_tester_${Date.now()}@cybersec.local`;
    await User.deleteMany({ email: /phase6_tester_/ });
    await GmailConnection.deleteMany({});
    await OAuthPendingState.deleteMany({});

    // ─── TEST 1: Token Encryption & Decryption ────────────────────────────
    console.log('--- TEST 1: AES-256-GCM OAuth Token Cryptography ---');
    const sampleToken = 'ya29.a0AfH6SMB_secret_google_oauth_token_' + Math.random().toString(36);
    const encryptedJson = encryptionService.encryptField(sampleToken);
    
    assert(typeof encryptedJson === 'string', 'Encrypted token returned as serialized JSON string');
    const parsedPayload = JSON.parse(encryptedJson);
    assert(parsedPayload.ciphertext && parsedPayload.iv && parsedPayload.authTag, 'Encrypted payload contains ciphertext, iv, and GCM authTag');
    assert(!encryptedJson.includes(sampleToken), 'Ciphertext does not expose plaintext token bytes');

    const decryptedToken = encryptionService.decryptField(encryptedJson);
    assert(decryptedToken === sampleToken, 'Decrypted token exactly matches original OAuth secret');

    // Tamper detection test
    let tampered = false;
    try {
      const tamperedPayload = { ...parsedPayload, ciphertext: 'ff' + parsedPayload.ciphertext.slice(2) };
      encryptionService.decryptField(JSON.stringify(tamperedPayload));
    } catch (e) {
      tampered = true;
    }
    assert(tampered, 'Tampered ciphertext fails GCM authentication check fail-closed');

    // ─── TEST 2: MIME Message Builder (base64url) ─────────────────────────
    console.log('\n--- TEST 2: RFC 2822 MIME Builder for Gmail API ---');
    const rawMime = gmailService.buildMimeMessage({
      from: 'Vault Operator <vault@gmail.com>',
      to: 'recipient@cybersec.local',
      subject: 'Critical Emergency Release',
      htmlBody: '<h1>Authorized Evidence</h1><p>Test Content</p>',
      textBody: 'Authorized Evidence: Test Content',
    });

    assert(typeof rawMime === 'string', 'MIME output is a string');
    assert(!rawMime.includes('+') && !rawMime.includes('/'), 'MIME string is base64url encoded (no + or / characters)');
    const decodedMime = Buffer.from(rawMime.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    assert(decodedMime.includes('Subject: Critical Emergency Release'), 'MIME contains standard RFC 2822 Subject header');
    assert(decodedMime.includes('multipart/alternative'), 'MIME uses multipart/alternative boundary format');
    assert(decodedMime.includes('<h1>Authorized Evidence</h1>'), 'MIME includes HTML body section');

    // ─── TEST 3: OAuth Consent URL Generation & State Verification ────────
    console.log('\n--- TEST 3: Google OAuth 2.0 URL & Anti-CSRF State ---');
    const fakeUserId = new mongoose.Types.ObjectId();
    const { url: authUrl, state: oauthState } = gmailService.generateAuthUrl(fakeUserId);

    assert(authUrl.includes('accounts.google.com/o/oauth2'), 'Generated URL targets Google OAuth 2.0 endpoint');
    assert(authUrl.includes('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send'), 'URL requests minimal gmail.send permission');
    assert(authUrl.includes('access_type=offline'), 'URL requests offline access for refresh token generation');
    assert(authUrl.includes('prompt=consent'), 'URL enforces consent prompt for guaranteed refresh token');
    assert(authUrl.includes(process.env.GOOGLE_CLIENT_ID), 'URL includes configured GOOGLE_CLIENT_ID');

    const isValidState = gmailService.verifyState(fakeUserId, oauthState);
    assert(isValidState === true, 'Anti-CSRF state HMAC verifies against owner userId');

    const isTamperedStateValid = gmailService.verifyState(new mongoose.Types.ObjectId(), oauthState);
    assert(isTamperedStateValid === false, 'State token generated for another user is rejected');

    // ─── TEST 4: User Registration & Protected Route Checks ───────────────
    console.log('\n--- TEST 4: API Route Authentication & Authorization ---');
    const regRes = await apiRequest('POST', '/api/auth/register', {
      fullName: 'Agent Cyber Zero',
      email: testEmail,
      password: 'StrongVaultPassword2026!',
    });
    const userToken = regRes.body?.data?.token;
    const testUserId = regRes.body?.data?.user?._id || regRes.body?.data?.user?.id;
    assert(regRes.status === 201 && userToken, 'Test user registered successfully with JWT');

    // Test unauthorized access
    const unauthStatus = await apiRequest('GET', '/api/gmail/status');
    assert(unauthStatus.status === 401, 'GET /api/gmail/status rejects unauthenticated requests (401)');

    const unauthConnect = await apiRequest('POST', '/api/gmail/connect');
    assert(unauthConnect.status === 401, 'POST /api/gmail/connect rejects unauthenticated requests (401)');

    const unauthSend = await apiRequest('POST', '/api/gmail/send-test', {
      recipientEmail: 'target@test.com',
    });
    assert(unauthSend.status === 401, 'POST /api/gmail/send-test rejects unauthenticated requests (401)');

    const unauthDisconnect = await apiRequest('DELETE', '/api/gmail/disconnect');
    assert(unauthDisconnect.status === 401, 'DELETE /api/gmail/disconnect rejects unauthenticated requests (401)');

    // ─── TEST 5: Authenticated Status & Connect Initiation ────────────────
    console.log('\n--- TEST 5: Status Check & Pending OAuth Session Storage ---');
    const authStatusRes = await apiRequest('GET', '/api/gmail/status', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(authStatusRes.status === 200, 'GET /api/gmail/status succeeds with valid JWT (200)');
    assert(authStatusRes.body.connected === false, 'Correctly reports disconnected when no Gmail account linked');

    const authConnectRes = await apiRequest('POST', '/api/gmail/connect', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(authConnectRes.status === 200, 'POST /api/gmail/connect creates OAuth pending state (200)');
    assert(authConnectRes.body.authUrl.includes('accounts.google.com'), 'Returns valid Google authUrl for frontend redirect');

    const pendingStateRecord = await OAuthPendingState.findOne({ userId: testUserId });
    assert(pendingStateRecord !== null, 'OAuthPendingState persisted in MongoDB with TTL index');
    assert(pendingStateRecord.expiresAt > new Date(), 'Pending state TTL expiration set in the future');

    // ─── TEST 6: GmailConnection Secure Model & Projection ────────────────
    console.log('\n--- TEST 6: GmailConnection Vault Storage & Secret Shielding ---');
    const mockAccessToken = 'ya29.mock_access_token_12345';
    const mockRefreshToken = '1//0gmock_refresh_token_67890';

    const testConn = await GmailConnection.create({
      userId: testUserId,
      gmailAddress: 'verified.operator@gmail.com',
      encryptedAccessToken: encryptionService.encryptField(mockAccessToken),
      encryptedRefreshToken: encryptionService.encryptField(mockRefreshToken),
      tokenExpiryAt: new Date(Date.now() + 3600 * 1000),
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      status: 'connected',
    });
    assert(testConn._id !== undefined, 'GmailConnection record successfully persisted');

    // Verify projection masks tokens by default
    const queriedConn = await GmailConnection.findOne({ userId: testUserId });
    assert(queriedConn.encryptedAccessToken === undefined, 'Default MongoDB query strictly excludes encryptedAccessToken');
    assert(queriedConn.encryptedRefreshToken === undefined, 'Default MongoDB query strictly excludes encryptedRefreshToken');

    const safeObj = testConn.toSafeObject();
    assert(safeObj.gmailAddress === 'verified.operator@gmail.com', 'toSafeObject preserves safe metadata');
    assert(safeObj.encryptedAccessToken === undefined && safeObj.encryptedRefreshToken === undefined, 'toSafeObject never exposes tokens');

    // Verify GET /api/gmail/status returns connected now
    const updatedStatusRes = await apiRequest('GET', '/api/gmail/status', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(updatedStatusRes.status === 200, 'GET /api/gmail/status returns 200 after connection');
    assert(updatedStatusRes.body.connected === true, 'Reports connected: true');
    assert(updatedStatusRes.body.connection.gmailAddress === 'verified.operator@gmail.com', 'Correct Gmail address reported');
    assert(updatedStatusRes.body.connection.encryptedRefreshToken === undefined, 'API response never leaks token fields');

    // ─── TEST 7: OAuth Callback Error & Cancellation Handling ────────────
    console.log('\n--- TEST 7: Callback Error & Denial Routing ---');
    const callbackDeniedRes = await apiRequest('GET', '/api/gmail/oauth2callback?error=access_denied');
    assert(callbackDeniedRes.status === 302, 'Google OAuth callback redirects on denial (302)');
    assert(callbackDeniedRes.headers.location.includes('status=denied'), 'Redirect URL conveys access_denied status to frontend');

    const callbackInvalidStateRes = await apiRequest('GET', '/api/gmail/oauth2callback?code=mock_code&state=fake_unregistered_state');
    assert(callbackInvalidStateRes.status === 302, 'Callback redirects on unknown state (302)');
    assert(callbackInvalidStateRes.headers.location.includes('status=error'), 'Redirect URL conveys error status on state mismatch');

    // ─── TEST 8: Disconnect & Token Purge ──────────────────────────────────
    console.log('\n--- TEST 8: Disconnect & Secure Purge ---');
    const disconnectRes = await apiRequest('DELETE', '/api/gmail/disconnect', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(disconnectRes.status === 200, 'DELETE /api/gmail/disconnect returns 200');

    const remainingConn = await GmailConnection.findOne({ userId: testUserId });
    assert(remainingConn === null, 'GmailConnection record cleanly removed from database');

    const finalStatusRes = await apiRequest('GET', '/api/gmail/status', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(finalStatusRes.body.connected === false, 'Status returns disconnected after purge');

    // Clean up
    await User.deleteMany({ email: /phase6_tester_/ });
    await GmailConnection.deleteMany({ userId: testUserId });
    await OAuthPendingState.deleteMany({ userId: testUserId });

    console.log('\n======================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');

    server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nUnexpected verification error:', err);
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
