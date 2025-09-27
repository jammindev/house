import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
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

  const createZoneThroughUI = async (
    page: Page,
    name: string,
    options: {
      surface?: string;
      note?: string;
      afterCreate?: (editingRow: Locator) => Promise<void> | void;
      leaveEditingOpen?: boolean;
    } = {}
  ) => {
    const addZoneButton = page.getByRole('button', { name: /add zone/i });
    await expect(addZoneButton).toBeVisible();
    await addZoneButton.click();

    await page.getByPlaceholder('e.g., Kitchen, Garage, Garden').fill(name);
    if (options.surface !== undefined) {
      await page.getByPlaceholder(/surface/i).fill(options.surface);
    }
    if (options.note !== undefined) {
      await page.getByPlaceholder(/note/i).fill(options.note);
    }
    await page.getByRole('button', { name: /^save$/i }).click();

    const editingRow = page
      .getByRole('listitem')
      .filter({ has: page.locator(`input[value='${name}']`) })
      .first();

    await expect(editingRow).toBeVisible();

    if (options.afterCreate) {
      await options.afterCreate(editingRow);
    }

    if (options.leaveEditingOpen) {
      return editingRow;
    }

    await editingRow.getByRole('button', { name: /^save$/i }).click();

    const zoneRow = page.getByRole('listitem').filter({ hasText: name }).first();
    await expect(zoneRow).toBeVisible();

    return zoneRow;
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
    const note = 'Zone principale';
    const surface = '12.5';
    const zoneRow = await createZoneThroughUI(page, name, { note, surface });

    await expect(zoneRow.getByText(`Surface: ${surface} m²`)).toBeVisible();
    await expect(zoneRow.getByText(`Note: ${note}`)).toBeVisible();
  });

  test('allows renaming an existing zone', async ({ page }) => {
    await signInAndOpenZones(page);

    const name = zoneName();
    await createZoneThroughUI(page, name);

    const newName = `${name}-renamed`;
    const zoneRow = page.getByRole('listitem').filter({ hasText: name }).first();
    await zoneRow.getByRole('button', { name: /edit/i }).click();

    const editingRow = page.getByRole('listitem').filter({ has: page.locator('textarea') }).first();
    const editInput = editingRow.locator('input').first();
    await expect(editInput).toBeVisible();
    await editInput.fill(newName);
    await editingRow.getByPlaceholder(/surface/i).fill('18');
    await editingRow.getByPlaceholder(/note/i).fill('Mise à jour');
    await editingRow.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(newName)).toBeVisible();
    await expect(page.getByText('Surface: 18 m²')).toBeVisible();
    await expect(page.getByText('Note: Mise à jour')).toBeVisible();
  });

  test('opens the editor after creating a zone with existing values', async ({ page }) => {
    await signInAndOpenZones(page);

    const name = zoneName();
    const note = 'Pré-remplie';
    const surface = '7.5';

    const editingRow = await createZoneThroughUI(page, name, {
      surface,
      note,
      leaveEditingOpen: true,
    });

    const nameInput = editingRow.locator('input').first();
    await expect(nameInput).toHaveValue(name);
    await expect(editingRow.getByPlaceholder(/surface/i)).toHaveValue(surface);
    await expect(editingRow.getByPlaceholder(/note/i)).toHaveValue(note);

    await editingRow.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(name)).toBeVisible();
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
