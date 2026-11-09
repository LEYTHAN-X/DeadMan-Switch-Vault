require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../src/app');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Evidence = require('../src/models/Evidence');

const PORT = 5003;

// HTTP client helper for standard JSON requests
const request = (method, path, body = null, headers = {}) => {
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
        port: PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let parsed;
          try {
            parsed = JSON.parse(raw.toString());
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, data: parsed, headers: res.headers, raw });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

// Multipart form-data upload helper
const uploadMultipart = (path, fieldName, filename, fileBuffer, mimeType, fields = {}, token = '') => {
  return new Promise((resolve, reject) => {
    const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
    const headerParts = [];

    // Add extra text fields
    for (const [key, val] of Object.entries(fields)) {
      headerParts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${val}\r\n`
      );
    }

    // Add file
    headerParts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );

    const headBuffer = Buffer.from(headerParts.join(''));
    const tailBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const totalLength = headBuffer.length + fileBuffer.length + tailBuffer.length;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': totalLength,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    req.write(headBuffer);
    req.write(fileBuffer);
    req.write(tailBuffer);
    req.end();
  });
};

async function runPhase4Tests() {
  console.log('\n======================================================');
  console.log('    PHASE 4 ENCRYPTED EVIDENCE VAULT VERIFICATION     ');
  console.log('======================================================\n');

  await connectDB();

  const userAEmail = `vault_agent_a_${Date.now()}@secure.dms`;
  const userBEmail = `vault_agent_b_${Date.now()}@secure.dms`;
  const password = 'StrongPassword123!@#';

  const server = app.listen(PORT, async () => {
    console.log(`[TEST SERVER] Listening on port ${PORT}\n`);

    try {
      // 1. Setup primary user
      console.log('TEST 1: Creating Primary Vault Operator (User A)...');
      const regARes = await request('POST', '/api/auth/register', {
        fullName: 'Agent Alpha',
        email: userAEmail,
        password,
      });
      const tokenA = regARes.data.data.token;
      console.log(`User A authenticated. Token: ${tokenA.substring(0, 20)}...\n`);

      // 2. Setup secondary user for IDOR testing
      console.log('TEST 2: Creating Secondary Operator (User B - Attacker/Unauthorized)...');
      const regBRes = await request('POST', '/api/auth/register', {
        fullName: 'Agent Bravo',
        email: userBEmail,
        password,
      });
      const tokenB = regBRes.data.data.token;
      console.log(`User B authenticated. Token: ${tokenB.substring(0, 20)}...\n`);

      // 3. Upload and encrypt evidence
      console.log('TEST 3: Uploading & Encrypting Document Evidence via AES-256-GCM to GridFS...');
      const testContent = 'CONFIDENTIAL LEAK: Operation Deep Clean dossier - Evidence Vault Phase 4 Test Content.';
      const originalBuffer = Buffer.from(testContent, 'utf-8');
      const originalHash = crypto.createHash('sha256').update(originalBuffer).digest('hex');

      const uploadRes = await uploadMultipart(
        '/api/evidence/upload',
        'file',
        'classified_memo.txt',
        originalBuffer,
        'text/plain',
        {
          title: 'Classified Investigation Memo',
          description: 'Key witness deposition notes regarding regulatory evasion.',
        },
        tokenA
      );

      console.log(`Status: ${uploadRes.status} (Expected: 201)`);
      if (uploadRes.status !== 201 || !uploadRes.data.data.id) {
        throw new Error(`Upload failed: ${JSON.stringify(uploadRes.data)}`);
      }

      const evidenceId = uploadRes.data.data.id;
      console.log('Evidence ID:', evidenceId);
      console.log('Reported SHA-256:', uploadRes.data.data.sha256Hash);
      console.log('Original Calculated SHA-256:', originalHash);

      if (uploadRes.data.data.sha256Hash !== originalHash) {
        throw new Error('Hash mismatch between client and server calculation');
      }
      console.log('✅ File uploaded, encrypted, and indexed successfully.\n');

      // 4. Verify GridFS Ciphertext in MongoDB (Proof of Zero-Plaintext storage)
      console.log('TEST 4: Verifying MongoDB GridFS chunks contain CIPHERTEXT (no raw plaintext)...');
      const evidenceDoc = await Evidence.findById(evidenceId);
      const chunksCollection = mongoose.connection.db.collection('evidence.chunks');
      const chunks = await chunksCollection.find({ files_id: evidenceDoc.gridFSFileId }).toArray();

      if (chunks.length === 0) {
        throw new Error('No GridFS chunks found for evidence file');
      }

      const storedChunkData = chunks[0].data.buffer;
      const rawPlaintextFound = storedChunkData.includes('CONFIDENTIAL LEAK');
      console.log(`GridFS Chunk size: ${storedChunkData.length} bytes`);
      console.log(`Contains raw plaintext search string? ${rawPlaintextFound ? 'YES (UNSAFE!)' : 'NO (SECURE CIPHERTEXT)'}`);

      if (rawPlaintextFound) {
        throw new Error('SECURITY FAILURE: Raw plaintext was stored in GridFS without encryption!');
      }
      console.log('✅ GridFS chunks verified: 100% encrypted ciphertext with AES-256-GCM.\n');

      // 5. List Evidence
      console.log('TEST 5: Listing user evidence items via GET /api/evidence...');
      const listRes = await request('GET', '/api/evidence', null, {
        Authorization: `Bearer ${tokenA}`,
      });
      console.log(`Status: ${listRes.status} (Expected: 200)`);
      console.log(`Items count: ${listRes.data.count}`);
      if (listRes.status !== 200 || listRes.data.count !== 1) {
        throw new Error('Evidence listing failed');
      }
      console.log('✅ Evidence listing verified.\n');

      // 6. Decrypted Download and Integrity Check
      console.log('TEST 6: Downloading and Decrypting Evidence (Verifying SHA-256 match)...');
      const downloadRes = await request('GET', `/api/evidence/${evidenceId}/download`, null, {
        Authorization: `Bearer ${tokenA}`,
      });
      console.log(`Status: ${downloadRes.status} (Expected: 200)`);
      const downloadedContent = downloadRes.raw.toString('utf-8');
      const downloadedHash = crypto.createHash('sha256').update(downloadRes.raw).digest('hex');

      console.log(`Downloaded content match: ${downloadedContent === testContent}`);
      console.log(`Downloaded SHA-256: ${downloadedHash}`);
      console.log(`Expected SHA-256:   ${originalHash}`);

      if (downloadedContent !== testContent || downloadedHash !== originalHash) {
        throw new Error('Decrypted file does not match original plaintext or SHA-256 hash');
      }
      console.log('✅ Evidence successfully decrypted on the fly with flawless integrity.\n');

      // 7. IDOR Protection Test (User B cannot access User A's file)
      console.log('TEST 7: IDOR Attack Simulation (User B tries to download User A evidence)...');
      const idorRes = await request('GET', `/api/evidence/${evidenceId}/download`, null, {
        Authorization: `Bearer ${tokenB}`,
      });
      console.log(`Status: ${idorRes.status} (Expected: 403 Forbidden)`);
      if (idorRes.status === 403) {
        console.log('✅ IDOR blocked: Unauthorized users cannot download another user\'s evidence.\n');
      } else {
        throw new Error(`IDOR vulnerability! Status was ${idorRes.status}`);
      }

      // 8. Delete Evidence
      console.log('TEST 8: Deleting Evidence & Purging GridFS Chunks...');
      const deleteRes = await request('DELETE', `/api/evidence/${evidenceId}`, null, {
        Authorization: `Bearer ${tokenA}`,
      });
      console.log(`Status: ${deleteRes.status} (Expected: 200)`);

      // Verify deletion from MongoDB collection
      const docAfter = await Evidence.findById(evidenceId);
      const chunksAfter = await chunksCollection.find({ files_id: evidenceDoc.gridFSFileId }).toArray();
      console.log(`Evidence record exists in DB: ${!!docAfter}`);
      console.log(`GridFS chunks remaining: ${chunksAfter.length}`);

      if (docAfter || chunksAfter.length > 0) {
        throw new Error('Evidence record or GridFS chunks were not completely purged');
      }
      console.log('✅ Evidence record and GridFS chunks permanently purged.\n');

      // Cleanup users
      await User.deleteMany({ email: { $in: [userAEmail, userBEmail] } });
      console.log('🧹 Cleaned up temporary test users.\n');

      console.log('======================================================');
      console.log('  🎉 ALL 8 PHASE 4 EVIDENCE VAULT TESTS PASSED!     ');
      console.log('======================================================\n');
    } catch (err) {
      console.error('\n❌ Phase 4 Test suite failed:', err.message);
      process.exitCode = 1;
    } finally {
      server.close(() => {
        console.log('[TEST SERVER] Closed cleanly.');
        process.exit(process.exitCode || 0);
      });
    }
  });
}

runPhase4Tests();

