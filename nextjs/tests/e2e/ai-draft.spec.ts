import { test, expect } from '@playwright/test';
import path from 'path';
import type { Page } from '@playwright/test';

import {
  createTestUser,
  cleanupTestUser,
  createZone,
  type TestUserContext,
} from './utils/supabaseAdmin';

test.describe('dashboard AI interaction draft', () => {
  let context: TestUserContext | null = null;

  const requireContext = (): TestUserContext => {
    if (!context) throw new Error('Test context not initialised');
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

  test.beforeEach(async () => {
    context = await createTestUser();
    const ctx = requireContext();
    await createZone(ctx, { name: 'Salon' });
  });

  test.afterEach(async () => {
    if (context) {
      await cleanupTestUser(context);
      context = null;
    }
  });

  test('prefills quote and staged file from AI prompt', async ({ page }) => {
    await signIn(page);

    // Mock AI response to avoid external call
    await page.route('**/api/ai/interaction-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: {
            subject: 'Devis véranda 12000€',
            content: 'Devis reçu pour la véranda, montant 12000€ TTC.',
            type: 'quote',
            status: 'pending',
          },
        }),
      });
    });

    await page.goto('/app/dashboard');

    const promptArea = page.getByPlaceholder(/plumber fixed|Plumber fixed/i);
    await promptArea.fill('J’ai reçu le devis de 12000 euros pour la véranda');

    // Stage an attachment via the modal
    await page.getByRole('button', { name: /attach files/i }).click();
    const filePath = path.resolve(__dirname, 'fixtures', 'sample.txt');
    await page.setInputFiles('input[type="file"]', filePath);
    await page.getByRole('button', { name: /done|save|close/i }).click().catch(() => {});

    await page.getByRole('button', { name: /generate draft/i }).click();

    await page.waitForURL('**/app/interactions/new/quote**', { timeout: 15000 });

    await expect(page.locator('#interaction-subject')).toHaveValue(/Devis véranda 12000€/i);
    await expect(page.locator('textarea')).toHaveValue(/12000€/);
    await expect(page.getByText(/sample\.txt/i)).toBeVisible();
  });
});
