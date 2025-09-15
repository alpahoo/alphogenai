import { expect, test } from '@playwright/test';

const PROD_URL = 'https://app.alphogen.com';
const TEST_EMAIL = 'qa-user@mailinator.com';
const TEST_PASSWORD = 'Test1234!';

test.describe('Authentication E2E', () => {
  test('should load sign-in page without blank screen', async ({ page }) => {
    await page.goto(`${PROD_URL}/en/sign-in`);

    await expect(page.locator('h2')).toContainText('Sign in to AlphoGenAI');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should load French sign-up page without blank screen', async ({ page }) => {
    await page.goto(`${PROD_URL}/fr/sign-up`);

    await expect(page.locator('h2')).toContainText('Create your AlphoGenAI account');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should complete full authentication flow', async ({ page }) => {
    await page.goto(`${PROD_URL}/en/sign-in`);

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('[data-testid="dashboard-root"]')).toBeVisible();
  });

  test('should verify session endpoint after login', async ({ page, request }) => {
    await page.goto(`${PROD_URL}/en/sign-in`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await request.get(`${PROD_URL}/api/debug/session`, {
      headers: { Cookie: cookieHeader },
    });
    const data = await response.json();

    expect(data.hasSession).toBe(true);
  });
});
