import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUser, type TestUserContext } from './utils/supabaseAdmin';

test.describe('authentication', () => {
  let context: TestUserContext | null = null;

  test.afterEach(async () => {
    if (context) {
      await cleanupTestUser(context);
      context = null;
    }
  });

  test('redirects guests from /app to the login screen', async ({ page }) => {
    await page.goto('/app');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('allows a confirmed Supabase user to sign in and reach the dashboard', async ({ page }) => {
    context = await createTestUser();

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(context.email);
    await page.getByLabel(/password/i).fill(context.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/app', { timeout: 15000 });
    await expect(page.getByText(`Household: ${context.householdName}`)).toBeVisible();
  });
});
