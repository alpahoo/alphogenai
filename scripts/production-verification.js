async function runProductionVerification() {
  const PROD_URL = 'https://app.alphogen.com';

  console.log('🔍 Starting Production Verification');
  console.log(`Verifying: ${PROD_URL}`);
  console.log('=' * 50);

  const results = {
    timestamp: new Date().toISOString(),
    prodUrl: PROD_URL,
    tests: {},
    summary: {
      passed: 0,
      failed: 0,
      total: 0,
    },
  };

  try {
    console.log('\n1️⃣ Testing debug endpoints...');

    const envResponse = await fetch(`${PROD_URL}/api/debug/env`);
    if (envResponse.ok) {
      const envData = await envResponse.json();
      results.tests.debugEnv = {
        status: 'PASS',
        data: envData,
        allTrue: Object.values(envData).every(v => v === true),
      };
      console.log('✅ Debug env endpoint working');
      console.log(`   Environment variables: ${JSON.stringify(envData, null, 2)}`);
    } else {
      results.tests.debugEnv = {
        status: 'FAIL',
        error: `HTTP ${envResponse.status}`,
      };
      console.log('❌ Debug env endpoint failed');
    }

    const sessionResponse = await fetch(`${PROD_URL}/api/debug/session`);
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      results.tests.debugSession = {
        status: 'PASS',
        data: sessionData,
      };
      console.log('✅ Debug session endpoint working');
      console.log(`   Session data: ${JSON.stringify(sessionData, null, 2)}`);
    } else {
      results.tests.debugSession = {
        status: 'FAIL',
        error: `HTTP ${sessionResponse.status}`,
      };
      console.log('❌ Debug session endpoint failed');
    }

    console.log('\n2️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${PROD_URL}/api/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      results.tests.health = {
        status: 'PASS',
        data: healthData,
      };
      console.log('✅ Health endpoint working');
      console.log(`   Health data: ${JSON.stringify(healthData, null, 2)}`);
    } else {
      results.tests.health = {
        status: 'FAIL',
        error: `HTTP ${healthResponse.status}`,
      };
      console.log('❌ Health endpoint failed');
    }

    console.log('\n3️⃣ Testing frontend pages...');
    const pages = ['/fr/sign-up', '/fr/sign-in', '/fr/dashboard'];

    for (const page of pages) {
      try {
        const pageResponse = await fetch(`${PROD_URL}${page}`);
        if (pageResponse.ok) {
          results.tests[`frontend${page.replace(/\//g, '_')}`] = {
            status: 'PASS',
            statusCode: pageResponse.status,
          };
          console.log(`✅ Page ${page} loads successfully`);
        } else {
          results.tests[`frontend${page.replace(/\//g, '_')}`] = {
            status: 'FAIL',
            statusCode: pageResponse.status,
          };
          console.log(`❌ Page ${page} failed: ${pageResponse.status}`);
        }
      } catch (error) {
        results.tests[`frontend${page.replace(/\//g, '_')}`] = {
          status: 'FAIL',
          error: error.message,
        };
        console.log(`❌ Page ${page} error: ${error.message}`);
      }
    }

    Object.values(results.tests).forEach((test) => {
      results.summary.total++;
      if (test.status === 'PASS') {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    });

    console.log('\n📊 Production Verification Summary:');
    console.log(`   Total tests: ${results.summary.total}`);
    console.log(`   Passed: ${results.summary.passed}`);
    console.log(`   Failed: ${results.summary.failed}`);
    console.log(`   Success rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);

    const fs = require('node:fs');
    fs.writeFileSync('/tmp/production-verification-results.json', JSON.stringify(results, null, 2));
    console.log('\n📄 Results saved to /tmp/production-verification-results.json');

    return results;
  } catch (error) {
    console.error('\n❌ Production Verification FAILED');
    console.error(`Error: ${error.message}`);

    results.tests.global = {
      status: 'FAIL',
      error: error.message,
    };

    return results;
  }
}

if (require.main === module) {
  runProductionVerification()
    .then((results) => {
      const success = results.summary.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Script error:', error);
      process.exit(1);
    });
}

module.exports = { runProductionVerification };
