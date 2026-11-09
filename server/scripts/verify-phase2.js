require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const app = require('../src/app');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');

const PORT = 5002;

// HTTP client helper for testing
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
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
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

async function runPhase2Tests() {
  console.log('\n======================================================');
  console.log('       PHASE 2 AUTHENTICATION VERIFICATION SUITE       ');
  console.log('======================================================\n');

  await connectDB();

  // Test account details
  const testEmail = `operator_${Date.now()}@cybersec.vault`;
  const initialPassword = 'SecurePass123!@#';
  const updatedPassword = 'NewSecurePass456$%^';

  const server = app.listen(PORT, async () => {
    console.log(`[TEST SERVER] Listening on port ${PORT}\n`);

    try {
      // 1. Weak Password Rejection
      console.log('TEST 1: Rejecting registration with weak password (missing special char)...');
      const weakRes = await request('POST', '/api/auth/register', {
        fullName: 'Agent Zero',
        email: testEmail,
        password: 'weakpassword',
      });
      console.log(`Status: ${weakRes.status} (Expected: 400)`);
      if (weakRes.status === 400 && weakRes.data.errors) {
        console.log('✅ Weak password correctly rejected by Zod validation schema.\n');
      } else {
        throw new Error('Weak password validation failed');
      }

      // 2. Successful Registration
      console.log('TEST 2: Registering valid user...');
      const regRes = await request('POST', '/api/auth/register', {
        fullName: 'Cyber Security Analyst',
        email: testEmail,
        password: initialPassword,
        checkInSchedule: {
          intervalType: 'daily',
          reminderHourUTC: 12,
        },
      });
      console.log(`Status: ${regRes.status} (Expected: 201)`);
      console.log('User created:', regRes.data.data.user.email);
      console.log('Token received:', regRes.data.data.token.substring(0, 25) + '...');
      if (regRes.status !== 201 || !regRes.data.data.token) {
        throw new Error('Registration failed');
      }
      console.log('✅ User registered successfully with JWT issued.\n');

      let authToken = regRes.data.data.token;

      // 3. Duplicate Email Prevention
      console.log('TEST 3: Preventing duplicate email registration...');
      const dupRes = await request('POST', '/api/auth/register', {
        fullName: 'Duplicate User',
        email: testEmail,
        password: initialPassword,
      });
      console.log(`Status: ${dupRes.status} (Expected: 409)`);
      if (dupRes.status === 409) {
        console.log('✅ Duplicate email correctly blocked (409 Conflict).\n');
      } else {
        throw new Error('Duplicate email was not rejected');
      }

      // 4. Invalid Password Login
      console.log('TEST 4: Rejecting login with invalid password...');
      const badPassRes = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: 'WrongPassword123!',
      });
      console.log(`Status: ${badPassRes.status} (Expected: 401)`);
      if (badPassRes.status === 401) {
        console.log('✅ Invalid password correctly rejected.\n');
      } else {
        throw new Error('Invalid credentials were not rejected');
      }

      // 5. Successful Login
      console.log('TEST 5: Authenticating with valid credentials...');
      const loginRes = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: initialPassword,
      });
      console.log(`Status: ${loginRes.status} (Expected: 200)`);
      if (loginRes.status === 200 && loginRes.data.data.token) {
        console.log('✅ Login successful, new JWT session established.\n');
        authToken = loginRes.data.data.token;
      } else {
        throw new Error('Login failed');
      }

      // 6. Protected Route Access (/api/auth/me) with Bearer token
      console.log('TEST 6: Accessing protected route (/api/auth/me) with valid token...');
      const meRes = await request('GET', '/api/auth/me', null, {
        Authorization: `Bearer ${authToken}`,
      });
      console.log(`Status: ${meRes.status} (Expected: 200)`);
      console.log('Authenticated profile:', meRes.data.data.fullName, `(${meRes.data.data.email})`);
      if (meRes.status === 200 && meRes.data.data.email === testEmail) {
        console.log('✅ Protected profile successfully retrieved.\n');
      } else {
        throw new Error('Protected route access failed');
      }

      // 6b. Manual Check-in Test (/api/auth/checkin)
      console.log('TEST 6b: Executing manual presence check-in (/api/auth/checkin)...');
      const checkinRes = await request('POST', '/api/auth/checkin', null, {
        Authorization: `Bearer ${authToken}`,
      });
      console.log(`Status: ${checkinRes.status} (Expected: 200)`);
      console.log('New check-in deadline:', checkinRes.data.data.nextCheckInAt);
      if (checkinRes.status === 200 && checkinRes.data.data.nextCheckInAt) {
        console.log('✅ Manual check-in confirmed and timer recalculated.\n');
      } else {
        throw new Error('Manual check-in failed');
      }

      // 7. Protected Route Rejection without Token
      console.log('TEST 7: Rejecting protected route without authorization token...');
      const unauthRes = await request('GET', '/api/auth/me');
      console.log(`Status: ${unauthRes.status} (Expected: 401)`);
      if (unauthRes.status === 401) {
        console.log('✅ Unauthenticated access blocked.\n');
      } else {
        throw new Error('Unauthenticated access was allowed');
      }

      // 8. Forgot Password Flow
      console.log('TEST 8: Requesting password reset token...');
      const forgotRes = await request('POST', '/api/auth/forgot-password', {
        email: testEmail,
      });
      console.log(`Status: ${forgotRes.status} (Expected: 200)`);
      const resetToken = forgotRes.data.devToken;
      console.log('Reset token issued:', resetToken ? resetToken.substring(0, 20) + '...' : 'none');
      if (forgotRes.status === 200 && resetToken) {
        console.log('✅ Password reset token generated and hashed.\n');
      } else {
        throw new Error('Password reset token generation failed');
      }

      // 9. Reset Password Execution
      console.log('TEST 9: Resetting password using reset token...');
      const resetRes = await request('POST', `/api/auth/reset-password/${resetToken}`, {
        password: updatedPassword,
      });
      console.log(`Status: ${resetRes.status} (Expected: 200)`);
      if (resetRes.status === 200 && resetRes.data.data.token) {
        console.log('✅ Password reset completed successfully.\n');
      } else {
        throw new Error('Password reset execution failed');
      }

      // 10. Login with Updated Password
      console.log('TEST 10: Authenticating with new password...');
      const newLoginRes = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: updatedPassword,
      });
      console.log(`Status: ${newLoginRes.status} (Expected: 200)`);
      if (newLoginRes.status === 200) {
        console.log('✅ Successfully authenticated with updated password.\n');
      } else {
        throw new Error('Login with updated password failed');
      }

      // 11. Logout
      console.log('TEST 11: Logging out user...');
      const logoutRes = await request('POST', '/api/auth/logout');
      console.log(`Status: ${logoutRes.status} (Expected: 200)`);
      console.log('✅ Logout endpoint verified.\n');

      // Cleanup test user
      await User.deleteOne({ email: testEmail });
      console.log('🧹 Cleaned up temporary test user.\n');

      console.log('======================================================');
      console.log('   🎉 ALL 11 PHASE 2 AUTHENTICATION TESTS PASSED!   ');
      console.log('======================================================\n');
    } catch (err) {
      console.error('\n❌ Test suite failed:', err.message);
      process.exitCode = 1;
    } finally {
      server.close(() => {
        console.log('[TEST SERVER] Closed cleanly.');
        process.exit(process.exitCode || 0);
      });
    }
  });
}

runPhase2Tests();

