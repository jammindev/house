import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createTestUser, cleanupTestUser, type TestUserContext } from './utils/supabaseAdmin';

const zoneName = () => `Playwright Zone ${Date.now().toString(36)}`;

test.describe('zones management', () => {
  let context: TestUserContext | null = null;

  const requireContext = (): TestUserContext => {
    if (!context) {
      throw new Error('Test context not initialised');
    }
    return context;
  };

  const signInAndOpenZones = async (page: Page) => {
    const ctx = requireContext();

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(ctx.email);
    await page.getByLabel(/password/i).fill(ctx.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/app', { timeout: 15000 });
    await expect(page.getByText(`Household: ${ctx.householdName}`)).toBeVisible();

    await page.goto('/app/zones');
    await expect(page.getByRole('button', { name: ctx.householdName })).toBeVisible();
  };

  const createZoneThroughUI = async (page: Page, name: string) => {
    const addZoneButton = page.getByRole('button', { name: /add zone/i });
    await expect(addZoneButton).toBeVisible();
    await addZoneButton.click();

    await page.getByPlaceholder('e.g., Kitchen, Garage, Garden').fill(name);
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(name)).toBeVisible();
  };

  test.beforeEach(async () => {
    context = await createTestUser();
  });

  test.afterEach(async () => {
    if (context) {
      await cleanupTestUser(context);
      context = null;
    }
  });

  test('allows an authenticated user to create a zone', async ({ page }) => {
    await signInAndOpenZones(page);

    const name = zoneName();
    await createZoneThroughUI(page, name);
  });

  test('allows renaming an existing zone', async ({ page }) => {
    await signInAndOpenZones(page);

    const name = zoneName();
    await createZoneThroughUI(page, name);

    const newName = `${name}-renamed`;
    const zoneRow = page.getByRole('listitem').filter({ hasText: name }).first();
    await zoneRow.getByRole('button', { name: /rename/i }).click();

    const editingRow = page.getByRole('listitem').filter({ has: page.locator('input') }).first();
    const editInput = editingRow.locator('input').first();
    await expect(editInput).toBeVisible();
    await editInput.fill(newName);
    await editingRow.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(newName)).toBeVisible();
  });

  test('allows deleting an existing zone', async ({ page }) => {
    await signInAndOpenZones(page);

    const name = zoneName();
    await createZoneThroughUI(page, name);

    const zoneRow = page.getByRole('listitem').filter({ hasText: name }).first();
    await zoneRow.getByRole('button', { name: /^delete$/i }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
  });
});
