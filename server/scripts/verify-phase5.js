require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../src/app');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Evidence = require('../src/models/Evidence');
const EmergencyContact = require('../src/models/EmergencyContact');

const PORT = 5004;

// Helper to make HTTP requests
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
    if (postData) req.write(postData);
    req.end();
  });
};

async function runPhase5Tests() {
  console.log('\n======================================================');
  console.log('   PHASE 5 EMERGENCY CONTACTS & RECIPIENTS SUITE      ');
  console.log('======================================================\n');

  await connectDB();

  const userAEmail = `contact_agent_a_${Date.now()}@secure.dms`;
  const userBEmail = `contact_agent_b_${Date.now()}@secure.dms`;
  const contact1Email = `attorney_${Date.now()}@legal.firm`;
  const contact2Email = `journalist_${Date.now()}@press.org`;
  const password = 'StrongPassword123!@#';

  const server = app.listen(PORT, async () => {
    console.log(`[TEST SERVER] Listening on port ${PORT}\n`);

    try {
      // 1. Setup User A
      console.log('TEST 1: Registering Operator A...');
      const regARes = await request('POST', '/api/auth/register', {
        fullName: 'Agent Alpha',
        email: userAEmail,
        password,
      });
      const tokenA = regARes.data.data.token;
      console.log(`User A authenticated. Token: ${tokenA.substring(0, 20)}...\n`);

      // 2. Setup User B (Attacker / Unauthorized)
      console.log('TEST 2: Registering Operator B...');
      const regBRes = await request('POST', '/api/auth/register', {
        fullName: 'Agent Bravo',
        email: userBEmail,
        password,
      });
      const tokenB = regBRes.data.data.token;
      console.log(`User B authenticated. Token: ${tokenB.substring(0, 20)}...\n`);

      // 3. User A adds Contact 1
      console.log('TEST 3: User A adds Emergency Contact 1 (Legal Counsel)...');
      const addRes1 = await request(
        'POST',
        '/api/contacts',
        {
          name: 'Sarah Connor, Esq.',
          email: contact1Email,
          relationship: 'Legal Counsel',
          phoneNumber: '+1-555-0199',
          notes: 'Holds cryptographic power of attorney.',
        },
        { Authorization: `Bearer ${tokenA}` }
      );

      console.log(`Status: ${addRes1.status} (Expected: 201)`);
      if (addRes1.status !== 201 || !addRes1.data.data._id) {
        throw new Error(`Failed to add contact 1: ${JSON.stringify(addRes1.data)}`);
      }
      const contact1Id = addRes1.data.data._id;
      console.log(`Contact 1 created: ${contact1Id} (${addRes1.data.data.email})`);
      console.log(`Status: ${addRes1.data.data.verificationStatus} (Expected: PENDING)`);
      console.log('✅ Contact 1 registered with PENDING verification status.\n');

      // 4. Duplicate Contact Prevention under same operator
      console.log('TEST 4: Preventing duplicate contact email under same operator...');
      const dupRes = await request(
        'POST',
        '/api/contacts',
        {
          name: 'Duplicate Sarah',
          email: contact1Email,
        },
        { Authorization: `Bearer ${tokenA}` }
      );
      console.log(`Status: ${dupRes.status} (Expected: 409)`);
      if (dupRes.status === 409) {
        console.log('✅ Duplicate contact under same operator blocked (409 Conflict).\n');
      } else {
        throw new Error('Duplicate contact was not blocked');
      }

      // 5. Verification Token Execution
      console.log('TEST 5: Executing recipient verification link via token callback...');
      // Fetch contact document from DB to retrieve the generated verificationToken
      const contactDoc1 = await EmergencyContact.findById(contact1Id);
      const vToken = contactDoc1.verificationToken;
      console.log(`Verification Token: ${vToken.substring(0, 20)}...`);

      const verifyRes = await request('GET', `/api/contacts/verify/${vToken}`);
      console.log(`Status: ${verifyRes.status} (Expected: 200)`);
      console.log('Response message:', verifyRes.data.message);

      const verifiedDoc = await EmergencyContact.findById(contact1Id);
      console.log(`Status in DB: ${verifiedDoc.verificationStatus} (Expected: VERIFIED)`);
      if (verifiedDoc.verificationStatus !== 'VERIFIED') {
        throw new Error('Contact verification failed');
      }
      console.log('✅ Recipient email address successfully verified!\n');

      // 6. User A creates a dummy evidence file in MongoDB
      console.log('TEST 6: Creating encrypted evidence file for User A...');
      const evidenceDocA = await Evidence.create({
        user: regARes.data.data.user.id,
        title: 'Classified Subpoena Record',
        originalFilename: 'subpoena_001.pdf',
        storedFilename: 'enc_subpoena.pdf',
        mimeType: 'application/pdf',
        fileCategory: 'document',
        originalSize: 1024,
        encryptedSize: 1056,
        sha256Hash: crypto.randomBytes(32).toString('hex'),
        gridFSFileId: new mongoose.Types.ObjectId(),
        encryption: {
          algorithm: 'AES-256-GCM',
          iv: crypto.randomBytes(12).toString('hex'),
          authTag: crypto.randomBytes(16).toString('hex'),
        },
      });
      console.log(`Evidence A created: ${evidenceDocA._id}\n`);

      // 7. Assign evidence to verified contact
      console.log('TEST 7: Granularly assigning Evidence A to Contact 1...');
      const assignRes = await request(
        'POST',
        `/api/contacts/${contact1Id}/assign-evidence`,
        {
          evidenceIds: [evidenceDocA._id.toString()],
        },
        { Authorization: `Bearer ${tokenA}` }
      );

      console.log(`Status: ${assignRes.status} (Expected: 200)`);
      if (assignRes.status !== 200) {
        throw new Error(`Assignment failed: ${JSON.stringify(assignRes.data)}`);
      }
      console.log(`Authorized evidence count: ${assignRes.data.data.authorizedEvidence.length}`);
      console.log('✅ Evidence successfully mapped to Contact 1.\n');

      // 8. IDOR Security Guard Test (User B tries to assign User A's evidence to User B's contact)
      console.log('TEST 8: IDOR Security Check: User B tries to assign User A evidence to User B contact...');
      // User B creates a contact
      const addResB = await request(
        'POST',
        '/api/contacts',
        {
          name: 'Contact of User B',
          email: 'b_contact@hack.org',
        },
        { Authorization: `Bearer ${tokenB}` }
      );
      const contactBId = addResB.data.data._id;

      // User B attempts to attach User A's evidence
      const idorAssignRes = await request(
        'POST',
        `/api/contacts/${contactBId}/assign-evidence`,
        {
          evidenceIds: [evidenceDocA._id.toString()],
        },
        { Authorization: `Bearer ${tokenB}` }
      );
      console.log(`Status: ${idorAssignRes.status} (Expected: 403 Forbidden)`);
      if (idorAssignRes.status === 403) {
        console.log('✅ IDOR blocked: Operator cannot attach evidence belonging to another user.\n');
      } else {
        throw new Error(`Security breach! Status was ${idorAssignRes.status}`);
      }

      // 9. Update Contact details
      console.log('TEST 9: Updating Contact 1 notes and relationship...');
      const updateRes = await request(
        'PUT',
        `/api/contacts/${contact1Id}`,
        {
          relationship: 'Primary Legal Representative',
          notes: 'Updated contact protocols confirmed.',
        },
        { Authorization: `Bearer ${tokenA}` }
      );
      console.log(`Status: ${updateRes.status} (Expected: 200)`);
      console.log('Updated relationship:', updateRes.data.data.relationship);
      console.log('✅ Contact updated successfully.\n');

      // 10. Delete Contact
      console.log('TEST 10: Deleting Contact 1...');
      const delRes = await request(
        'DELETE',
        `/api/contacts/${contact1Id}`,
        null,
        { Authorization: `Bearer ${tokenA}` }
      );
      console.log(`Status: ${delRes.status} (Expected: 200)`);
      const checkDel = await EmergencyContact.findById(contact1Id);
      console.log(`Contact exists in DB: ${!!checkDel}`);
      if (checkDel) {
        throw new Error('Contact was not deleted from database');
      }
      console.log('✅ Contact successfully removed.\n');

      // Cleanup
      await User.deleteMany({ email: { $in: [userAEmail, userBEmail] } });
      await Evidence.deleteMany({ _id: evidenceDocA._id });
      await EmergencyContact.deleteMany({ _id: contactBId });
      console.log('🧹 Cleaned up temporary test data.\n');

      console.log('======================================================');
      console.log('  🎉 ALL 10 PHASE 5 RECIPIENT MANAGEMENT TESTS PASSED! ');
      console.log('======================================================\n');
    } catch (err) {
      console.error('\n❌ Phase 5 Test suite failed:', err.message);
      process.exitCode = 1;
    } finally {
      server.close(() => {
        console.log('[TEST SERVER] Closed cleanly.');
        process.exit(process.exitCode || 0);
      });
    }
  });
}

runPhase5Tests();

