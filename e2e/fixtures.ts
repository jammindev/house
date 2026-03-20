import { test as base, expect, type Page, type Locator } from '@playwright/test';

export interface CreateTaskOptions {
  priority?: '1' | '2' | '3'; // 1=Haute, 2=Normale, 3=Basse
  dueDate?: string;            // format YYYY-MM-DD
  isPrivate?: boolean;
}

export const test = base.extend<{
  loginAs: (email: string, password: string) => Promise<void>;
  createTask: (subject: string, options?: CreateTaskOptions) => Promise<void>;
}>({
  /**
   * loginAs : se connecte avec des credentials spécifiques.
   * Nécessite test.use({ storageState: { cookies: [], origins: [] } }) dans le describe.
   */
  loginAs: async ({ page }, use) => {
    await use(async (email, password) => {
      await page.goto('/login');
      await page.getByPlaceholder('Email').fill(email);
      await page.getByPlaceholder('Mot de passe').fill(password);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await expect(page).toHaveURL(/\/app\/dashboard/);
    });
  },

  /**
   * createTask : crée une tâche via le dialog.
   * Fonctionne depuis /app/tasks et depuis le panneau Tâches d'un projet.
   * Statut par défaut : "À faire".
   */
  createTask: async ({ page }, use) => {
    await use(async (subject: string, options?: CreateTaskOptions) => {
      await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByPlaceholder('Titre de la tâche…').fill(subject);

      // Zone (requise)
      const zoneSelect = page.locator('#task-zone');
      const firstZoneOption = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZoneOption.waitFor({ state: 'attached', timeout: 10000 });
      await zoneSelect.selectOption(await firstZoneOption.getAttribute('value') as string);

      if (options?.priority) {
        await page.locator('#task-priority').selectOption(options.priority);
      }

      if (options?.dueDate) {
        await page.locator('#task-date').fill(options.dueDate);
      }

      if (options?.isPrivate) {
        await page.locator('#task-private').check();
      }

      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByText(subject)).toBeVisible();
    });
  },
});

/**
 * Retourne le locator de la carte d'une tâche à partir de son sujet.
 * Remonte 4 niveaux depuis le texte du sujet pour atteindre le composant Card.
 */
export function getTaskCard(page: Page, subject: string): Locator {
  return page.getByText(subject, { exact: true }).locator('xpath=ancestor::*[4]');
}

/**
 * Ouvre le menu CardActions (bouton ···) d'une carte de tâche.
 */
export async function openTaskMenu(page: Page, subject: string): Promise<void> {
  const card = getTaskCard(page, subject);
  await card.locator('button').last().click();
}

export { expect } from '@playwright/test';
