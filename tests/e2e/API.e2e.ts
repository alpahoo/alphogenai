import { expect, test } from '@playwright/test';

const PROD_URL = 'https://app.alphogen.com';
const TEST_EMAIL = 'qa-user@mailinator.com';
const TEST_PASSWORD = 'Test1234!';

test.describe('API E2E', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: {
        'apikey': supabaseKey!,
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    const data = await response.json();
    authToken = data.access_token;

    expect(authToken).toBeTruthy();
  });

  test('should return health status', async ({ request }) => {
    const response = await request.get(`${PROD_URL}/api/health`);

    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(data.ok).toBe(true);
  });

  test('should create job with authentication', async ({ request }) => {
    const response = await request.post(`${PROD_URL}/api/jobs`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: { prompt: 'E2E test job' },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(data.job.id).toBeTruthy();
    expect(data.job.status).toBeTruthy();
    expect(data.job.progress).toBeDefined();
  });

  test('should handle webhook with secret', async ({ request }) => {
    const response = await request.post(`${PROD_URL}/api/webhooks/runpod`, {
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET!,
      },
      data: {
        id: 'test-job-id',
        status: 'COMPLETED',
        output: { result_url: 'https://example.com/result.mp4' },
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(data.success).toBe(true);
  });
});
