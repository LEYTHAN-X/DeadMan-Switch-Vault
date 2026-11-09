/**
 * verify-phase8.js
 * End-to-end verification test suite for Phase 8: Emergency Workflow & Fail-Closed State Machine.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const EmergencyEvent = require('../src/models/EmergencyEvent');
const EmergencyContact = require('../src/models/EmergencyContact');
const AuditLog = require('../src/models/AuditLog');
const emergencyService = require('../src/services/emergency/emergency.service');

const TEST_PORT = 5008;
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
  console.log('   PHASE 8 VERIFICATION: EMERGENCY WORKFLOW ENGINE');
  console.log('======================================================\n');

  let server;

  try {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    await mongoose.connect(TEST_MONGO_URI);
    console.log('[*] Connected to MongoDB for test suite.');

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`[*] Ephemeral test server listening on port ${TEST_PORT}.\n`);

    const testEmail = `phase8_tester_${Date.now()}@cybersec.local`;

    // ─── TEST 1: User Registration & Protected Routes ─────────────────────
    console.log('--- TEST 1: API Route Authentication Guards ---');
    const regRes = await apiRequest('POST', '/api/auth/register', {
      fullName: 'Agent Alpha Sentinel',
      email: testEmail,
      password: 'StrongVaultPassword2026!',
    });
    const userToken = regRes.body?.data?.token;
    const testUserId = regRes.body?.data?.user?._id || regRes.body?.data?.user?.id;
    assert(regRes.status === 201 && userToken, 'Test user registered successfully with JWT');

    const unauthStatus = await apiRequest('GET', '/api/emergency/status');
    assert(unauthStatus.status === 401, 'GET /api/emergency/status rejects unauthenticated requests (401)');

    const unauthCancel = await apiRequest('POST', '/api/emergency/cancel');
    assert(unauthCancel.status === 401, 'POST /api/emergency/cancel rejects unauthenticated requests (401)');

    const unauthVerify = await apiRequest('POST', '/api/emergency/verify', { code: '123456' });
    assert(unauthVerify.status === 401, 'POST /api/emergency/verify rejects unauthenticated requests (401)');

    const unauthApprove = await apiRequest('POST', '/api/emergency/approve', { isApproved: true });
    assert(unauthApprove.status === 401, 'POST /api/emergency/approve rejects unauthenticated requests (401)');

    // ─── TEST 2: Initial Status & State Machine Initialization ───────────
    console.log('\n--- TEST 2: State Machine Initial State ---');
    const initialStatusRes = await apiRequest('GET', '/api/emergency/status', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(initialStatusRes.status === 200, 'GET /api/emergency/status returns 200 with JWT');
    assert(initialStatusRes.body.data.currentStage === 'ACTIVE', 'Initial workflow stage is ACTIVE');

    // ─── TEST 3: Invalid Transition Guard (Fail-Closed) ───────────────────
    console.log('\n--- TEST 3: Invalid Transition Guard ---');
    let illegalTransitionBlocked = false;
    try {
      // Cannot jump from ACTIVE straight to AUTHORIZED_RELEASE
      await emergencyService.transitionStage(testUserId, 'AUTHORIZED_RELEASE');
    } catch (e) {
      illegalTransitionBlocked = e.statusCode === 400;
    }
    assert(illegalTransitionBlocked, 'Illegal state jump from ACTIVE to AUTHORIZED_RELEASE is blocked (400)');

    // ─── TEST 4: Full Multi-Stage Progression ─────────────────────────────
    console.log('\n--- TEST 4: Valid Stage Progression Sequence ---');
    // ACTIVE -> CHECK_IN_OVERDUE
    await emergencyService.transitionStage(testUserId, 'CHECK_IN_OVERDUE', 'Check-in deadline lapsed');
    let live = await emergencyService.getLiveStatus(testUserId);
    assert(live.currentStage === 'CHECK_IN_OVERDUE', 'Advanced to CHECK_IN_OVERDUE');

    // CHECK_IN_OVERDUE -> WARNING
    await emergencyService.transitionStage(testUserId, 'WARNING', 'Warning dispatches initiated');
    live = await emergencyService.getLiveStatus(testUserId);
    assert(live.currentStage === 'WARNING', 'Advanced to WARNING');

    // WARNING -> GRACE_PERIOD
    await emergencyService.transitionStage(testUserId, 'GRACE_PERIOD', 'Safety grace period buffer active');
    live = await emergencyService.getLiveStatus(testUserId);
    assert(live.currentStage === 'GRACE_PERIOD', 'Advanced to GRACE_PERIOD');

    // GRACE_PERIOD -> ADDITIONAL_VERIFICATION
    const reqVerificationRes = await emergencyService.requestAdditionalVerification(testUserId);
    assert(reqVerificationRes.stage === 'ADDITIONAL_VERIFICATION', 'Advanced to ADDITIONAL_VERIFICATION');
    assert(reqVerificationRes.code && reqVerificationRes.code.length === 6, 'Generated 6-digit confirmation code');

    // ─── TEST 5: Verification Code Validation ─────────────────────────────
    console.log('\n--- TEST 5: Additional Verification Code Validation ---');
    // Wrong code should be rejected
    const badVerifyRes = await apiRequest(
      'POST',
      '/api/emergency/verify',
      { code: '000000' },
      { Authorization: `Bearer ${userToken}` }
    );
    assert(badVerifyRes.status === 400, 'Invalid verification code is rejected (400)');

    // Correct code advances to APPROVAL gate
    const correctVerifyRes = await apiRequest(
      'POST',
      '/api/emergency/verify',
      { code: reqVerificationRes.code },
      { Authorization: `Bearer ${userToken}` }
    );
    assert(correctVerifyRes.status === 200, 'Valid code confirmed successfully (200)');
    assert(
      correctVerifyRes.body.stage === 'MANUAL_OR_PREAUTHORIZED_RELEASE_APPROVAL',
      'Advanced to MANUAL_OR_PREAUTHORIZED_RELEASE_APPROVAL'
    );

    // ─── TEST 6: Fail-Closed Security Release Gates ───────────────────────
    console.log('\n--- TEST 6: Fail-Closed Safeguards Before Release ---');
    // Gate: Release without approval must be blocked
    let unapprovedBlocked = false;
    try {
      await emergencyService.executeAuthorizedRelease(testUserId);
    } catch (e) {
      unapprovedBlocked = e.statusCode === 403;
    }
    assert(unapprovedBlocked, 'Release execution without pre-authorization approval is blocked (403)');

    // Now approve release
    const approveRes = await apiRequest(
      'POST',
      '/api/emergency/approve',
      { isApproved: true },
      { Authorization: `Bearer ${userToken}` }
    );
    assert(approveRes.status === 200, 'POST /api/emergency/approve succeeded (200)');

    // Gate: Release with 0 verified contacts must be blocked fail-closed!
    let zeroContactsBlocked = false;
    try {
      await emergencyService.executeAuthorizedRelease(testUserId);
    } catch (e) {
      zeroContactsBlocked = e.statusCode === 403 && e.message.includes('Zero verified emergency recipients');
    }
    assert(zeroContactsBlocked, 'Release with 0 verified emergency contacts is blocked fail-closed (403)');

    // ─── TEST 7: Emergency Cancellation & Full Recovery ───────────────────
    console.log('\n--- TEST 7: Emergency Cancellation & State Recovery ---');
    const cancelRes = await apiRequest(
      'POST',
      '/api/emergency/cancel',
      { reason: 'Operator verified safety in verification test suite' },
      { Authorization: `Bearer ${userToken}` }
    );
    assert(cancelRes.status === 200, 'POST /api/emergency/cancel returns 200');
    assert(cancelRes.body.status === 'ACTIVE', 'Response reports status restored to ACTIVE');

    const restoredUser = await User.findById(testUserId);
    assert(restoredUser.status === 'ACTIVE', 'User record in MongoDB restored to ACTIVE');
    assert(restoredUser.nextCheckInAt > new Date(), 'Next check-in deadline recalculated into future');

    const finalStatus = await apiRequest('GET', '/api/emergency/status', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(finalStatus.body.data.currentStage === 'ACTIVE', 'Live status API reports ACTIVE');

    // ─── TEST 8: Audit Log Trail Verification ─────────────────────────────
    console.log('\n--- TEST 8: Audit Trail Integrity ---');
    const auditLogs = await AuditLog.find({ userId: testUserId });
    const cancelLog = auditLogs.find((l) => l.action === 'EMERGENCY_WORKFLOW_CANCELLED');
    assert(cancelLog !== undefined, 'Audit record for EMERGENCY_WORKFLOW_CANCELLED persisted');

    const transitionLogs = auditLogs.filter((l) => l.action === 'EMERGENCY_STAGE_TRANSITIONED');
    assert(transitionLogs.length >= 3, 'Audit trail contains all intermediate state transitions');

    // Clean up
    await User.deleteMany({ email: /phase8_tester_/ });
    await EmergencyEvent.deleteMany({ userId: testUserId });
    await AuditLog.deleteMany({ userId: testUserId });

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

