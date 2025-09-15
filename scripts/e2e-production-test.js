const { createClient } = require('@supabase/supabase-js');

async function runE2ETest() {
  const PROD_URL = 'https://app.alphogen.com';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const adminPassword = process.env.ADMIN_BOOT_PWD;

  console.log('🚀 Starting E2E Production Test');
  console.log(`Testing against: ${PROD_URL}`);

  try {
    console.log('\n1️⃣ Testing admin login...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'founder@alphogen.com',
      password: adminPassword,
    });

    if (authError) {
      throw new Error(`Admin login failed: ${authError.message}`);
    }

    const accessToken = authData.session.access_token;
    console.log('✅ Admin login successful');

    console.log('\n2️⃣ Testing job creation...');
    const jobResponse = await fetch(`${PROD_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'E2E test job creation' }),
    });

    if (!jobResponse.ok) {
      throw new Error(`Job creation failed: ${jobResponse.status} ${jobResponse.statusText}`);
    }

    const jobData = await jobResponse.json();
    const jobId = jobData.job.id;
    console.log(`✅ Job created successfully: ${jobId}`);
    console.log(`   Status: ${jobData.job.status}, Progress: ${jobData.job.progress}`);

    console.log('\n3️⃣ Testing job retrieval...');
    const getJobResponse = await fetch(`${PROD_URL}/api/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!getJobResponse.ok) {
      throw new Error(`Job retrieval failed: ${getJobResponse.status}`);
    }

    const retrievedJob = await getJobResponse.json();
    console.log(`✅ Job retrieved successfully: ${retrievedJob.job.id}`);

    console.log('\n4️⃣ Testing webhook simulation...');
    const webhookResponse = await fetch(`${PROD_URL}/api/webhooks/runpod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({
        id: jobId,
        status: 'COMPLETED',
        output: { result_url: 'https://example.com/test-result.mp4' },
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed: ${webhookResponse.status}`);
    }

    const webhookData = await webhookResponse.json();
    console.log('✅ Webhook processed successfully');
    console.log(`   Updated job: ${webhookData.job.id}, Status: ${webhookData.job.status}`);

    console.log('\n5️⃣ Verifying job update...');
    const finalJobResponse = await fetch(`${PROD_URL}/api/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const finalJob = await finalJobResponse.json();
    if (finalJob.job.status !== 'done' || finalJob.job.progress !== 100) {
      throw new Error(`Job not properly updated. Status: ${finalJob.job.status}, Progress: ${finalJob.job.progress}`);
    }

    console.log('✅ Job update verified successfully');

    console.log('\n6️⃣ Testing webhook security...');
    const unauthorizedWebhookResponse = await fetch(`${PROD_URL}/api/webhooks/runpod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: jobId,
        status: 'COMPLETED',
        output: { result_url: 'https://example.com/unauthorized.mp4' },
      }),
    });

    if (unauthorizedWebhookResponse.status !== 401) {
      throw new Error(`Webhook security failed: expected 401, got ${unauthorizedWebhookResponse.status}`);
    }

    console.log('✅ Webhook security verified (401 without secret)');

    console.log('\n🎉 E2E Test PASSED - All systems operational!');
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Admin login: founder@alphogen.com`);
    console.log(`   ✅ Job creation: ${jobId}`);
    console.log(`   ✅ Job retrieval: Working`);
    console.log(`   ✅ Webhook processing: Working`);
    console.log(`   ✅ Job status update: done (100%)`);
    console.log(`   ✅ Webhook security: 401 without secret`);

    return {
      success: true,
      jobId,
      summary: 'All E2E tests passed successfully',
    };
  } catch (error) {
    console.error('\n❌ E2E Test FAILED');
    console.error(`Error: ${error.message}`);

    return {
      success: false,
      error: error.message,
    };
  }
}

if (require.main === module) {
  runE2ETest()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Script error:', error);
      process.exit(1);
    });
}

module.exports = { runE2ETest };
