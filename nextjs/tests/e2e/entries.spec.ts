import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';

import {
  createTestUser,
  cleanupTestUser,
  createZone,
  createEntry,
  getEntryById,
  countEntryFiles,
  createHouseholdMember,
  cleanupHouseholdMember,
  type TestUserContext,
} from './utils/supabaseAdmin';

const entryText = () => `Playwright Entry ${Date.now().toString(36)}`;

test.describe('entries', () => {
  let context: TestUserContext | null = null;
  let additionalMembers: TestUserContext[] = [];

  const requireContext = (): TestUserContext => {
    if (!context) {
      throw new Error('Test context not initialised');
    }
    return context;
  };

  const signIn = async (page: Page) => {
    const ctx = requireContext();

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(ctx.email);
    await page.getByLabel(/password/i).fill(ctx.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/app', { timeout: 15000 });
    await expect(page.getByText(`Household: ${ctx.householdName}`)).toBeVisible();
  };

  const openEntriesList = async (page: Page) => {
    await signIn(page);
    await page.goto('/app/interactions');
    await expect(page.getByRole('heading', { name: /entries/i })).toBeVisible();
  };

  test.beforeEach(async () => {
    context = await createTestUser();
    additionalMembers = [];
  });

  test.afterEach(async () => {
    if (additionalMembers.length) {
      for (const member of additionalMembers) {
        await cleanupHouseholdMember(member);
      }
      additionalMembers = [];
    }
    if (context) {
      await cleanupTestUser(context);
      context = null;
    }
  });

  test('lists existing entries for the household', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const text = entryText();
    await createEntry(ctx, { rawText: text, zoneIds: [zone.id] });

    await openEntriesList(page);

    await expect(page.getByText(text)).toBeVisible();
  });

  test('allows creating a new entry with zone selection', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const text = entryText();

    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    await page.getByPlaceholder(/write your entry here/i).fill(text);
    await page.getByRole('button', { name: /create entry/i }).click();

    await page.waitForURL('**/app/interactions*', { timeout: 15000 });
    await expect(page.getByText(text)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Entry created successfully').first()).toBeVisible();
  });

  test('selecting a child zone removes its parent from the selection', async ({ page }) => {
    const ctx = requireContext();
    const parentZone = await createZone(ctx, { name: 'Maison' });
    const childZone = await createZone(ctx, { name: 'Cuisine', parentId: parentZone.id });

    await signIn(page);
    await page.goto('/app/interactions/new');

    const parentButton = page.locator(`[data-zone-id="${parentZone.id}"]`);
    const childButton = page.locator(`[data-zone-id="${childZone.id}"]`);

    await expect(parentButton).toBeVisible();
    await expect(childButton).toBeVisible();

    await parentButton.click();
    await expect(parentButton).toHaveAttribute('aria-pressed', 'true');

    await childButton.click();
    await expect(childButton).toHaveAttribute('aria-pressed', 'true');
    await expect(parentButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('uploads an attachment and shows it on the entry detail page', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const text = entryText();
    const filePath = path.resolve(__dirname, 'fixtures/sample.txt');

    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    await page.setInputFiles('input[type="file"]', filePath);
    await page.getByPlaceholder(/write your entry here/i).fill(text);
    await page.getByRole('button', { name: /create entry/i }).click();

    await page.waitForURL('**/app/interactions*', { timeout: 20000 });
    const entryLink = page.getByRole('link', { name: new RegExp(text) });
    await expect(entryLink).toBeVisible({ timeout: 15000 });

    await entryLink.click();
    await page.waitForURL(/\/app\/entries\/.+/);
    await expect(page.getByText('Attachments').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('text/plain').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /open/i })).toBeVisible();
  });

  test('allows deleting an attachment the user uploaded', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const text = entryText();
    const filePath = path.resolve(__dirname, 'fixtures/sample.txt');

    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    await page.setInputFiles('input[type="file"]', filePath);
    await page.getByPlaceholder(/write your entry here/i).fill(text);
    await page.getByRole('button', { name: /create entry/i }).click();

    await page.waitForURL('**/app/interactions*', { timeout: 20000 });
    const entryLink = page.getByRole('link', { name: new RegExp(text) });
    await entryLink.click();
    await page.waitForURL(/\/app\/entries\/.+/);

    const fileCard = page.locator('div').filter({ hasText: 'text/plain' }).first();
    const deleteButton = fileCard.getByRole('button', { name: /^delete$/i });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const dialog = page.getByRole('alertdialog', { name: /delete this file/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByText('text/plain')).toHaveCount(0);
  });

  test('deleting an entry removes its attachments', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const text = entryText();
    const filePath = path.resolve(__dirname, 'fixtures/sample.txt');

    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    await page.setInputFiles('input[type="file"]', filePath);
    await page.getByPlaceholder(/write your entry here/i).fill(text);
    await page.getByRole('button', { name: /create entry/i }).click();

    await page.waitForURL('**/app/interactions*', { timeout: 20000 });
    const entryLink = page.getByRole('link', { name: new RegExp(text) });
    await entryLink.click();
    await page.waitForURL(/\/app\/entries\/.+/);

    const entryUrl = page.url();
    const entryId = entryUrl.split('/').pop() ?? '';

    await page.getByRole('button', { name: /delete entry/i }).click();
    const dialog = page.getByRole('alertdialog', { name: /delete this entry/i });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect(page).toHaveURL(/\/app\/entries$/);
    await expect(page.getByText(text)).toHaveCount(0);

    await expect.poll(async () => await countEntryFiles(entryId)).toBe(0);
    await expect.poll(async () => (await getEntryById(entryId)) ? 1 : 0).toBe(0);
  });

  test('allows another household member to delete an entry', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const otherMember = await createHouseholdMember(ctx);
    additionalMembers.push(otherMember);
    const text = entryText();
    const filePath = path.resolve(__dirname, 'fixtures/sample.txt');

    // Owner creates an entry with an attachment
    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    await page.setInputFiles('input[type="file"]', filePath);
    await page.getByPlaceholder(/write your entry here/i).fill(text);
    await page.getByRole('button', { name: /create entry/i }).click();

    await page.waitForURL('**/app/interactions*', { timeout: 20000 });
    const entryLink = page.getByRole('link', { name: new RegExp(text) });
    await entryLink.click();
    await page.waitForURL(/\/app\/entries\/.+/);

    const entryUrl = page.url();
    const entryId = entryUrl.split('/').pop() ?? '';
    await expect(page.getByText('text/plain').first()).toBeVisible();

    // Sign out owner session
    await page.context().clearCookies();
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });

    // Sign in as other household member
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(otherMember.email);
    await page.getByLabel(/password/i).fill(otherMember.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/app', { timeout: 20000 });
    await page.goto(`/app/interactions/${entryId}`);
    await expect(page.getByText(text)).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('text/plain').first()).toBeVisible();

    await page.getByRole('button', { name: /delete entry/i }).click();
    const dialog = page.getByRole('alertdialog', { name: /delete this entry/i });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect(page).toHaveURL(/\/app\/entries$/);
    await expect(page.getByText(text)).toHaveCount(0);

    await expect.poll(async () => await countEntryFiles(entryId)).toBe(0);
    await expect.poll(async () => (await getEntryById(entryId)) ? 1 : 0).toBe(0);
  });

  test('blocks creation when no zone is selected', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const text = entryText();

    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();

    await page.getByPlaceholder(/write your entry here/i).fill(text);

    const createButton = page.getByRole('button', { name: /create entry/i });
    await expect(createButton).toBeDisabled();
  });

  test('blocks creation when raw text is empty', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);

    await signIn(page);
    await page.goto('/app/interactions/new');

    const zoneButton = page.locator(`[data-zone-id="${zone.id}"]`);
    await expect(zoneButton).toBeVisible();
    await zoneButton.click();

    await page.getByPlaceholder(/write your entry here/i).fill('   ');
    await page.getByRole('button', { name: /create entry/i }).click();

    await expect(page).toHaveURL(/\/app\/entries\/new$/);
    await expect(page.getByText('Raw text is required')).toBeVisible();
  });
});
