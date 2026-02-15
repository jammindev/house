import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  createTestUser,
  cleanupTestUser,
  createZone,
  createInteraction,
  createHouseholdMember,
  cleanupHouseholdMember,
  getInteractionById,
  type TestUserContext,
} from './utils/supabaseAdmin';

const noteSubject = () => `Playwright Note ${Date.now().toString(36)}`;

test.describe('interactions (note flows)', () => {
  let context: TestUserContext | null = null;
  let extraMember: TestUserContext | null = null;

  const requireContext = (): TestUserContext => {
    if (!context) {
      throw new Error('Test context not initialised');
    }
    return context;
  };

  const acceptCookies = async (page: Page) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
    const hostname = new URL(base).hostname;
    await page.context().addCookies([
      { name: 'cookie-accept', value: 'accepted', domain: hostname, path: '/' },
    ]);
    // Fallback: click banner if it still appears
    const acceptButton = page.getByRole('button', { name: /accept/i });
    if (await acceptButton.isVisible().catch(() => false)) {
      await acceptButton.click();
    }
  };

  const signIn = async (page: Page, user: TestUserContext = requireContext()) => {
    await acceptCookies(page);
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/app**', { timeout: 20000 });
    await expect(page.getByRole('link', { name: /interactions/i })).toBeVisible({ timeout: 20000 });
  };

  test.beforeEach(async () => {
    context = await createTestUser();
  });

  test.afterEach(async () => {
    if (extraMember) {
      await cleanupHouseholdMember(extraMember);
      extraMember = null;
    }
    if (context) {
      await cleanupTestUser(context);
      context = null;
    }
  });

  test('lets a user pick the note type and create an interaction', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const subject = noteSubject();
    const description = `Playwright description ${Date.now().toString(36)}`;

    await signIn(page);

    await page.goto('/app/interactions/new');
    await page.getByRole('button', { name: /note/i }).click();
    await page.waitForURL('**/app/interactions/new/note', { timeout: 15000 });

    await page.getByLabel(/subject/i).fill(subject);
    await page.locator(`[data-zone-id="${zone.id}"]`).click();
    await page.getByPlaceholder(/write your interaction here/i).fill(description);

    await page.getByRole('button', { name: /create note/i }).click();

    await page.waitForURL(/\/app\/interactions/, { timeout: 20000 });
    await expect(page.getByText(subject)).toBeVisible({ timeout: 15000 });
  });

  test('shows an error when submitting a note without zones', async ({ page }) => {
    const ctx = requireContext();
    await createZone(ctx);
    const subject = noteSubject();

    await signIn(page);
    await page.goto('/app/interactions/new/note');

    await page.getByLabel(/subject/i).fill(subject);
    await page.getByPlaceholder(/write your interaction here/i).fill('Missing zones');
    await page.getByRole('button', { name: /create note/i }).click();

    await expect(page.getByText('Please select at least one zone for this interaction.')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/interactions\/new\/note/);
  });

  test('allows another household member to delete an interaction', async ({ page }) => {
    const ctx = requireContext();
    const zone = await createZone(ctx);
    const subject = noteSubject();

    const { id: interactionId } = await createInteraction(ctx, {
      content: `${subject} content`,
      zoneIds: [zone.id],
      subject,
      type: 'note',
    });

    extraMember = await createHouseholdMember(ctx);

    await signIn(page, extraMember);

    await page.goto(`/app/interactions/${interactionId}`);
    await expect(page.getByRole('heading', { name: subject })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /^delete$/i }).click();
    const dialog = page.getByRole('alertdialog', { name: /delete this interaction/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /delete interaction/i }).click();

    await expect(page).toHaveURL(/\/app\/interactions/, { timeout: 20000 });
    await expect.poll(async () => (await getInteractionById(interactionId)) ? 1 : 0).toBe(0);
  });
});
