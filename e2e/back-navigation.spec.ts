import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Retour contextuel : depuis une page de détail, le lien « Retour » ramène
// à la page d'origine (ex: le projet) et non à la liste par défaut.
// ---------------------------------------------------------------------------

// Ouvre le projet seedé et retourne son URL de détail.
async function goToProject(page: Page): Promise<string> {
  await page.goto('/app/projects');
  await page.getByRole('link', { name: 'Rénovation salle de bain' }).click();
  await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+$/);
  return page.url();
}

// Crée une note liée au projet via le formulaire dédié (flux déterministe).
async function createProjectNote(page: Page, projectUrl: string, subject: string) {
  const projectId = projectUrl.split('/').pop();
  await page.goto(`/app/interactions/new?type=note&project_id=${projectId}`);
  await page.getByPlaceholder('Résumé court').fill(subject);
  await page.getByRole('button', { name: 'Ajouter un événement' }).click();
  await expect(page).not.toHaveURL(/\/app\/interactions\/new/);
}

test('retour vers le projet depuis le détail d\'une note ouverte via l\'onglet Notes', async ({ page }) => {
  const subject = `Note retour E2E ${Date.now()}`;
  const projectUrl = await goToProject(page);
  await createProjectNote(page, projectUrl, subject);

  // Onglet Notes du projet → détail de la note.
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Notes' }).click();
  await page.getByRole('link', { name: new RegExp(subject) }).click();
  await expect(page).toHaveURL(/\/app\/interactions\/[0-9a-f-]+$/);

  // Le lien retour ramène au projet, pas à la liste des interactions.
  await page.getByRole('link', { name: 'Retour', exact: true }).click();
  await expect(page).toHaveURL(projectUrl);
});

test('retour vers le projet depuis le détail d\'une note de l\'aperçu', async ({ page }) => {
  const subject = `Note aperçu retour E2E ${Date.now()}`;
  const projectUrl = await goToProject(page);
  await createProjectNote(page, projectUrl, subject);

  // La note apparaît dans l'aperçu du projet → détail → retour.
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Aperçu' }).click();
  await page.getByRole('link', { name: new RegExp(subject) }).click();
  await expect(page).toHaveURL(/\/app\/interactions\/[0-9a-f-]+$/);

  await page.getByRole('link', { name: 'Retour', exact: true }).click();
  await expect(page).toHaveURL(projectUrl);
});

test('fallback : le détail d\'une note ouvert en direct retombe sur la liste', async ({ page }) => {
  const subject = `Note fallback E2E ${Date.now()}`;

  await page.goto('/app/interactions/new');
  await page.getByPlaceholder('Résumé court').fill(subject);
  await page.getByRole('button', { name: 'Ajouter un événement' }).click();
  await expect(page).toHaveURL(/\/app\/interactions$/);

  await page.getByRole('link', { name: subject }).click();
  await expect(page).toHaveURL(/\/app\/interactions\/[0-9a-f-]+$/);
  const detailUrl = page.url();

  // Accès direct à l'URL (nouvelle entrée d'historique, sans state) : plus
  // d'origine en mémoire → fallback liste. Un simple reload préserverait
  // history.state, d'où le passage par le dashboard.
  await page.goto('/app/dashboard');
  await page.goto(detailUrl);
  // (scopé au main pour ne pas matcher le lien « Activité » de la sidebar)
  await page.getByRole('main').getByRole('link', { name: 'Activité', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/interactions$/);
});
