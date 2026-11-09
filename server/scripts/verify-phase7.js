/**
 * verify-phase7.js
 * End-to-end verification test suite for Phase 7: Check-In Engine (BullMQ + Redis & DB Scanner).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const checkinService = require('../src/services/checkin/checkin.service');
const { updateScheduleSchema } = require('../src/validators/checkin.validator');
const { QUEUE_NAMES } = require('../src/queues/queue.service');

const TEST_PORT = 5007;
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
  console.log('   PHASE 7 VERIFICATION: CHECK-IN ENGINE & SCHEDULES');
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

    const testEmail = `phase7_tester_${Date.now()}@cybersec.local`;

    // ─── TEST 1: Deadline Calculation Logic ───────────────────────────────
    console.log('--- TEST 1: Deadline Calculation Engine ---');
    const baseDate = new Date('2026-01-01T12:00:00Z');

    const dailyDeadline = checkinService.calculateNextDeadline({ intervalType: 'daily' }, baseDate);
    assert(
      dailyDeadline.toISOString() === '2026-01-02T12:00:00.000Z',
      'Daily cadence advances deadline by exactly 24 hours'
    );

    const weeklyDeadline = checkinService.calculateNextDeadline({ intervalType: 'weekly' }, baseDate);
    assert(
      weeklyDeadline.toISOString() === '2026-01-08T12:00:00.000Z',
      'Weekly cadence advances deadline by exactly 7 days'
    );

    const customDaysDeadline = checkinService.calculateNextDeadline(
      { intervalType: 'custom', customIntervalDays: 3 },
      baseDate
    );
    assert(
      customDaysDeadline.toISOString() === '2026-01-04T12:00:00.000Z',
      'Custom interval in days (3 days) advances deadline correctly (+72h)'
    );

    const customHoursDeadline = checkinService.calculateNextDeadline(
      { intervalType: 'custom', customIntervalHours: 12 },
      baseDate
    );
    assert(
      customHoursDeadline.toISOString() === '2026-01-01T24:00:00.000Z' ||
        customHoursDeadline.toISOString() === '2026-01-02T00:00:00.000Z',
      'Custom interval in hours (12h) advances deadline correctly'
    );

    // ─── TEST 2: Zod Validator Guard ──────────────────────────────────────
    console.log('\n--- TEST 2: Schema Validation & Security Constraints ---');
    const validConfig = updateScheduleSchema.safeParse({
      intervalType: 'daily',
      gracePeriodHours: 24,
      reminderOffsetsHours: [6, 2],
    });
    assert(validConfig.success === true, 'Valid schedule payload passes Zod validation');

    const invalidType = updateScheduleSchema.safeParse({
      intervalType: 'yearly_invalid',
    });
    assert(invalidType.success === false, 'Invalid intervalType is rejected');

    const negativeGrace = updateScheduleSchema.safeParse({
      intervalType: 'daily',
      gracePeriodHours: -5,
    });
    assert(negativeGrace.success === false, 'Negative gracePeriodHours is rejected');

    const excessiveGrace = updateScheduleSchema.safeParse({
      intervalType: 'daily',
      gracePeriodHours: 9999,
    });
    assert(excessiveGrace.success === false, 'Grace period exceeding 168 hours (7 days) is rejected');

    // ─── TEST 3: User Registration & Protected Routes ─────────────────────
    console.log('\n--- TEST 3: Check-in API Authentication Guards ---');
    const regRes = await apiRequest('POST', '/api/auth/register', {
      fullName: 'Sentinel Checkin Agent',
      email: testEmail,
      password: 'StrongVaultPassword2026!',
    });
    const userToken = regRes.body?.data?.token;
    const testUserId = regRes.body?.data?.user?._id || regRes.body?.data?.user?.id;
    assert(regRes.status === 201 && userToken, 'Test user registered with JWT');

    const unauthGet = await apiRequest('GET', '/api/checkin/config');
    assert(unauthGet.status === 401, 'GET /api/checkin/config rejects unauthenticated requests (401)');

    const unauthPut = await apiRequest('PUT', '/api/checkin/config', { intervalType: 'weekly' });
    assert(unauthPut.status === 401, 'PUT /api/checkin/config rejects unauthenticated requests (401)');

    const unauthCheckIn = await apiRequest('POST', '/api/checkin/now');
    assert(unauthCheckIn.status === 401, 'POST /api/checkin/now rejects unauthenticated requests (401)');

    // ─── TEST 4: Get & Update Schedule Configuration ──────────────────────
    console.log('\n--- TEST 4: Get & Update Schedule Config ---');
    const getConfigRes = await apiRequest('GET', '/api/checkin/config', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(getConfigRes.status === 200, 'GET /api/checkin/config returns 200 with JWT');
    assert(getConfigRes.body.data.status === 'ACTIVE', 'Initial status is ACTIVE');
    assert(getConfigRes.body.data.schedule.intervalType === 'daily', 'Initial intervalType is daily');

    // Update to custom 48 hours with 36h grace period
    const updateConfigRes = await apiRequest(
      'PUT',
      '/api/checkin/config',
      {
        intervalType: 'custom',
        customIntervalHours: 48,
        gracePeriodHours: 36,
        reminderOffsetsHours: [12, 6],
      },
      {
        Authorization: `Bearer ${userToken}`,
      }
    );
    assert(updateConfigRes.status === 200, 'PUT /api/checkin/config successfully updates schedule (200)');
    assert(updateConfigRes.body.data.schedule.intervalType === 'custom', 'Updated intervalType is custom');
    assert(updateConfigRes.body.data.schedule.customIntervalHours === 48, 'customIntervalHours updated to 48');
    assert(updateConfigRes.body.data.schedule.gracePeriodHours === 36, 'gracePeriodHours updated to 36');

    // Verify in MongoDB
    const userInDb = await User.findById(testUserId);
    assert(userInDb.checkInSchedule.customIntervalHours === 48, 'Schedule successfully persisted in MongoDB');

    // ─── TEST 5: Manual Check-In ("I Am Safe") & Auto-Recovery ────────────
    console.log('\n--- TEST 5: Manual Check-In ("I Am Safe") & State Recovery ---');
    // Simulate user becoming overdue
    userInDb.status = 'CHECK_IN_OVERDUE';
    userInDb.warningSentAt = new Date();
    userInDb.gracePeriodExpiresAt = new Date(Date.now() + 36 * 3600 * 1000);
    await userInDb.save();

    const overdueUserCheck = await User.findById(testUserId);
    assert(overdueUserCheck.status === 'CHECK_IN_OVERDUE', 'Simulated overdue state verified');

    // Perform manual check-in
    const checkInRes = await apiRequest('POST', '/api/checkin/now', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(checkInRes.status === 200, 'POST /api/checkin/now returns 200');
    assert(checkInRes.body.status === 'ACTIVE', 'Check-in automatically restores status to ACTIVE');
    assert(checkInRes.body.checkInCount >= 1, 'checkInCount incremented');

    const recoveredUser = await User.findById(testUserId);
    assert(recoveredUser.status === 'ACTIVE', 'MongoDB record restored to ACTIVE status');
    assert(recoveredUser.warningSentAt === null, 'warningSentAt cleared on successful check-in');
    assert(recoveredUser.gracePeriodExpiresAt === null, 'gracePeriodExpiresAt cleared on successful check-in');
    assert(recoveredUser.nextCheckInAt > new Date(), 'nextCheckInAt successfully projected into future');

    // ─── TEST 6: Audit Logging for Check-In Events ────────────────────────
    console.log('\n--- TEST 6: Audit Trail Integrity ---');
    const auditLogs = await AuditLog.find({ userId: testUserId });
    assert(auditLogs.length >= 2, 'Audit logs recorded for schedule update and check-in');
    const checkInLog = auditLogs.find((l) => l.metadata?.type !== 'SCHEDULE_CONFIG_UPDATED');
    assert(checkInLog !== undefined, 'CHECK_IN_PERFORMED audit entry found');
    assert(checkInLog.action === 'CHECK_IN_PERFORMED', 'Action logged correctly as CHECK_IN_PERFORMED');

    // ─── TEST 7: Queue Topology Specifications ────────────────────────────
    console.log('\n--- TEST 7: BullMQ Queue Topology ---');
    assert(QUEUE_NAMES.REMINDERS === 'dms-checkin-reminders', 'Reminder queue name matches specification');
    assert(QUEUE_NAMES.DEADLINE === 'dms-deadline-monitoring', 'Deadline queue name matches specification');
    assert(QUEUE_NAMES.GRACE_PERIOD === 'dms-grace-period', 'Grace period queue name matches specification');
    assert(QUEUE_NAMES.VERIFICATION === 'dms-verification', 'Verification queue name matches specification');
    assert(QUEUE_NAMES.EVIDENCE_DELIVERY === 'dms-evidence-delivery', 'Evidence delivery queue name matches specification');

    // Clean up
    await User.deleteMany({ email: /phase7_tester_/ });
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

