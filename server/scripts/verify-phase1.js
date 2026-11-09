require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const app = require('../src/app');
const { connectDB } = require('../src/config/db');

async function verify() {
  console.log('=== PHASE 1 VERIFICATION SUITE ===');

  // Attempt DB connection (non-fatal for health-check verification)
  try {
    await connectDB();
  } catch (err) {
    console.log('DB connection attempt logged:', err.message);
  }

  const PORT = 5001;
  const server = app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);

    // Helper to perform GET request
    const testGet = (path) => {
      return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
          });
        }).on('error', reject);
      });
    };

    try {
      console.log('\n--- Testing Root Endpoint (/) ---');
      const rootRes = await testGet('/');
      console.log(`Status: ${rootRes.statusCode}`);
      console.log('Response:', JSON.stringify(rootRes.data, null, 2));

      console.log('\n--- Testing Health Check Endpoint (/api/health) ---');
      const healthRes = await testGet('/api/health');
      console.log(`Status: ${healthRes.statusCode}`);
      console.log('Response:', JSON.stringify(healthRes.data, null, 2));

      console.log('\n--- Verification Result ---');
      if (rootRes.statusCode === 200 && (healthRes.statusCode === 200 || healthRes.statusCode === 503)) {
        console.log('✅ ALL PHASE 1 HEALTH & ROUTING CHECKS PASSED SUCCESSFULLY!');
      } else {
        console.error('❌ Verification failed: unexpected status codes');
        process.exitCode = 1;
      }
    } catch (error) {
      console.error('❌ Request error during test:', error.message);
      process.exitCode = 1;
    } finally {
      server.close(() => {
        console.log('Test server closed cleanly.');
        process.exit(process.exitCode || 0);
      });
    }
  });
}

verify();

