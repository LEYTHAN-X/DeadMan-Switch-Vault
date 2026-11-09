/**
 * verify-phase9.js
 * End-to-end verification test suite for Phase 9: Comprehensive Audit Logging & Security Hardening.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');

const TEST_PORT = 5009;
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
  console.log('   PHASE 9 VERIFICATION: AUDIT LOGS & SECURITY HARDENING');
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

    const testEmail = `phase9_tester_${Date.now()}@cybersec.local`;

    // ─── TEST 1: Helmet Security Headers Verification ─────────────────────
    console.log('--- TEST 1: Helmet Security Headers & Policy Defenses ---');
    const healthRes = await apiRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'Health endpoint responds with 200');

    const headers = healthRes.headers;
    assert(headers['x-frame-options'] === 'DENY', 'Anti-clickjacking header (X-Frame-Options: DENY) enforced');
    assert(headers['x-content-type-options'] === 'nosniff', 'MIME sniffing protection (X-Content-Type-Options: nosniff) enforced');
    assert(headers['strict-transport-security'] !== undefined, 'HSTS (Strict-Transport-Security) header present');
    assert(headers['content-security-policy'] !== undefined, 'Content-Security-Policy (CSP) header active');

    // ─── TEST 2: User Registration & Initial Audit Logging ────────────────
    console.log('\n--- TEST 2: Registration & Audit Trail Creation ---');
    const regRes = await apiRequest('POST', '/api/auth/register', {
      fullName: 'Chief Security Officer',
      email: testEmail,
      password: 'StrongVaultPassword2026!',
    });
    const userToken = regRes.body?.data?.token;
    const testUserId = regRes.body?.data?.user?._id || regRes.body?.data?.user?.id;
    assert(regRes.status === 201 && userToken, 'Operator registered with JWT');

    // Create a few audit logs for test filtering
    await AuditLog.create([
      {
        userId: testUserId,
        action: 'USER_LOGIN',
        ipAddress: '127.0.0.1',
        metadata: { client: 'web' },
      },
      {
        userId: testUserId,
        action: 'EVIDENCE_UPLOADED',
        ipAddress: '127.0.0.1',
        metadata: { fileName: 'top_secret_evidence.pdf', size: 1048576 },
      },
      {
        userId: testUserId,
        action: 'CONTACT_ADDED',
        ipAddress: '127.0.0.1',
        metadata: { contactName: 'Trusted Recipient' },
      },
      {
        userId: testUserId,
        action: 'GMAIL_EMAIL_SENT',
        ipAddress: '127.0.0.1',
        metadata: { to: 'recipient@test.com' },
      },
      {
        userId: testUserId,
        action: 'EMERGENCY_STAGE_TRANSITIONED',
        ipAddress: '127.0.0.1',
        metadata: { toStage: 'CHECK_IN_OVERDUE' },
      },
    ]);

    // ─── TEST 3: Audit Log Query & Category Filtering ─────────────────────
    console.log('\n--- TEST 3: Audit Log Querying & Category Filtering ---');
    const allLogsRes = await apiRequest('GET', '/api/audit', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(allLogsRes.status === 200, 'GET /api/audit returns 200 with JWT');
    assert(allLogsRes.body.data.length >= 5, 'Returns all audit log events');
    assert(allLogsRes.body.pagination.total >= 5, 'Pagination metadata calculated correctly');

    // Filter by category: EVIDENCE
    const evidenceLogsRes = await apiRequest('GET', '/api/audit?category=EVIDENCE', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(evidenceLogsRes.status === 200, 'GET /api/audit?category=EVIDENCE returns 200');
    assert(
      evidenceLogsRes.body.data.every((l) => l.action.startsWith('EVIDENCE')),
      'Category filter strictly isolates EVIDENCE events'
    );

    // Filter by category: GMAIL
    const gmailLogsRes = await apiRequest('GET', '/api/audit?category=GMAIL', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(
      gmailLogsRes.body.data.every((l) => l.action.startsWith('GMAIL')),
      'Category filter strictly isolates GMAIL events'
    );

    // Search keyword
    const searchRes = await apiRequest('GET', '/api/audit?search=top_secret', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(searchRes.body.data.length >= 1, 'Search query locates metadata keyword matches');

    // ─── TEST 4: Secret Shielding in Audit Logs ───────────────────────────
    console.log('\n--- TEST 4: Secret Shielding Invariant ---');
    const rawAuditRecords = await AuditLog.find({ userId: testUserId }).lean();
    let leaksDetected = false;

    for (const record of rawAuditRecords) {
      const serialized = JSON.stringify(record);
      if (
        serialized.includes('StrongVaultPassword2026') ||
        serialized.includes('GOCSPX-') ||
        serialized.includes('ya29.') ||
        serialized.includes('MASTER_ENCRYPTION_KEY')
      ) {
        leaksDetected = true;
      }
    }
    assert(!leaksDetected, 'Audit trail strictly shields passwords, OAuth tokens, and encryption keys');

    // ─── TEST 5: Audit Log Export (JSON & CSV) ────────────────────────────
    console.log('\n--- TEST 5: Tamper-Evident Log Exports ---');
    const jsonExportRes = await apiRequest('GET', '/api/audit/export?format=json', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(jsonExportRes.status === 200, 'JSON export endpoint returns 200');
    assert(jsonExportRes.body.vault === "Digital Dead Man's Switch", 'JSON export contains official vault metadata');
    assert(Array.isArray(jsonExportRes.body.logs), 'JSON export contains array of log records');

    const csvExportRes = await apiRequest('GET', '/api/audit/export?format=csv', null, {
      Authorization: `Bearer ${userToken}`,
    });
    assert(csvExportRes.status === 200, 'CSV export endpoint returns 200');
    assert(typeof csvExportRes.body === 'string' && csvExportRes.body.includes('Timestamp,Action'), 'CSV export formatted with headers');

    // ─── TEST 6: Profile & Password Rotation ──────────────────────────────
    console.log('\n--- TEST 6: Profile Update & Password Rotation ---');
    // Update profile
    const profileRes = await apiRequest(
      'PUT',
      '/api/auth/profile',
      { fullName: 'Commander Cipher' },
      { Authorization: `Bearer ${userToken}` }
    );
    assert(profileRes.status === 200, 'PUT /api/auth/profile returns 200');
    assert(profileRes.body.data.fullName === 'Commander Cipher', 'Full name updated in MongoDB');

    // Rotate password
    const changePwdRes = await apiRequest(
      'PUT',
      '/api/auth/change-password',
      {
        currentPassword: 'StrongVaultPassword2026!',
        newPassword: 'BrandNewHardenedPassword2026#',
      },
      { Authorization: `Bearer ${userToken}` }
    );
    assert(changePwdRes.status === 200, 'PUT /api/auth/change-password returns 200');

    // Old password should fail login now
    const oldLoginRes = await apiRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'StrongVaultPassword2026!',
    });
    assert(oldLoginRes.status === 401, 'Login with retired old password is rejected (401)');

    // New password succeeds
    const newLoginRes = await apiRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'BrandNewHardenedPassword2026#',
    });
    assert(newLoginRes.status === 200 && newLoginRes.body.data?.token, 'Login with rotated new password succeeds');

    // Clean up
    await User.deleteMany({ email: /phase9_tester_/ });
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

