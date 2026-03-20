import { test, expect, getTaskCard, openTaskMenu } from './fixtures';

// Navigue vers l'onglet Tâches du projet "Rénovation salle de bain" (seedé).
async function goToProjectTasks(page: Parameters<typeof getTaskCard>[0]) {
  await page.goto('/app/projects');
  await page.getByRole('link', { name: 'Rénovation salle de bain' }).click();
  await expect(page).toHaveURL(/\/app\/projects\//);
  await page.getByRole('button', { name: 'Tâches' }).click();
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------

test('affiche l\'onglet Tâches d\'un projet', async ({ page }) => {
  await goToProjectTasks(page);

  await expect(page.getByRole('button', { name: 'Nouvelle tâche' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

test('crée une tâche depuis le panneau projet', async ({ page, createTask }) => {
  await goToProjectTasks(page);

  const subject = `Tâche projet E2E ${Date.now()}`;
  await createTask(subject);

  await expect(page.getByText(subject)).toBeVisible();
});

test('la tâche créée dans le projet apparaît aussi dans la liste globale', async ({ page, createTask }) => {
  await goToProjectTasks(page);

  const subject = `Tâche projet global E2E ${Date.now()}`;
  await createTask(subject);

  await page.goto('/app/tasks');
  await expect(page.getByText(subject)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Modification
// ---------------------------------------------------------------------------

test('modifie une tâche depuis le panneau projet', async ({ page, createTask }) => {
  await goToProjectTasks(page);

  const subject = `Modif projet E2E ${Date.now()}`;
  await createTask(subject);

  await openTaskMenu(page, subject);
  await page.getByRole('menuitem', { name: 'Modifier' }).click();

  const dialog = page.getByRole('dialog');
  const subjectInput = dialog.getByPlaceholder('Titre de la tâche…');
  await subjectInput.clear();
  await subjectInput.fill(`${subject} — modifié`);
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText(`${subject} — modifié`)).toBeVisible();
  await expect(page.getByText(subject, { exact: true })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Changement de statut
// ---------------------------------------------------------------------------

test('change le statut d\'une tâche dans le panneau projet', async ({ page, createTask }) => {
  await goToProjectTasks(page);

  const subject = `Statut projet E2E ${Date.now()}`;
  await createTask(subject);

  const card = getTaskCard(page, subject);
  await card.getByRole('button', { name: 'À faire', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'En cours' }).click();

  await expect(card.getByRole('button', { name: 'En cours', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

test('supprime une tâche depuis le panneau projet', async ({ page, createTask }) => {
  await goToProjectTasks(page);

  const subject = `Suppression projet E2E ${Date.now()}`;
  await createTask(subject);

  await openTaskMenu(page, subject);
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();

  await expect(page.getByText(subject)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Filtrage
// ---------------------------------------------------------------------------

test('filtre les tâches par statut dans le panneau projet', async ({ page, createTask }) => {
  await goToProjectTasks(page);

  const pendingSubject = `Filtre Projet À faire ${Date.now()}`;
  const inProgressSubject = `Filtre Projet En cours ${Date.now()}`;

  await createTask(pendingSubject);
  await createTask(inProgressSubject);

  const card = getTaskCard(page, inProgressSubject);
  await card.getByRole('button', { name: 'À faire', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'En cours' }).click();
  await expect(card.getByRole('button', { name: 'En cours', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'En cours', exact: true }).first().click();

  await expect(page.getByText(inProgressSubject)).toBeVisible();
  await expect(page.getByText(pendingSubject)).not.toBeVisible();
});
