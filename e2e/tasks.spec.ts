import { test, expect, getTaskCard, openTaskMenu } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app/tasks');
});

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------

test('affiche la page des tâches', async ({ page }) => {
  await expect(page).toHaveURL(/\/app\/tasks/);
  await expect(page.getByRole('heading', { name: 'Tâches' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

test('ouvre le dialog de création de tâche', async ({ page }) => {
  await page.getByRole('button', { name: 'Nouvelle tâche' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByPlaceholder('Titre de la tâche…')).toBeVisible();
});

test('crée une tâche simple', async ({ page, createTask }) => {
  const subject = `Création E2E ${Date.now()}`;
  await createTask(subject);

  await expect(page.getByText(subject)).toBeVisible();
});

test('crée une tâche avec priorité haute', async ({ page, createTask }) => {
  const subject = `Priorité haute E2E ${Date.now()}`;
  await createTask(subject, { priority: '1' });

  // Indicateur rouge (span avec title "Haute priorité")
  await expect(getTaskCard(page, subject).locator('[title="Haute priorité"]')).toBeVisible();
});

test('crée une tâche avec date dépassée → badge "En retard"', async ({ page, createTask }) => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const subject = `En retard E2E ${Date.now()}`;
  await createTask(subject, { dueDate: yesterday });

  await expect(getTaskCard(page, subject).getByText('En retard', { exact: true })).toBeVisible();
});

test('crée une tâche privée', async ({ page, createTask }) => {
  const subject = `Privée E2E ${Date.now()}`;
  await createTask(subject, { isPrivate: true });

  // La tâche apparaît dans la liste
  await expect(page.getByText(subject)).toBeVisible();
  // L'icône cadenas est présente sur la carte (SVG Lucide Lock)
  await expect(getTaskCard(page, subject).locator('svg').nth(0)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Modification
// ---------------------------------------------------------------------------

test('modifie une tâche', async ({ page, createTask }) => {
  const subject = `Modif E2E ${Date.now()}`;
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

test('assigne une tâche à un membre', async ({ page, createTask }) => {
  const subject = `Assignation E2E ${Date.now()}`;
  await createTask(subject);

  await openTaskMenu(page, subject);
  await page.getByRole('menuitem', { name: 'Modifier' }).click();

  const dialog = page.getByRole('dialog');
  const assigneeSelect = page.locator('#task-assigned');
  const firstMemberOption = assigneeSelect.locator('option:not([disabled]):not([value=""])').first();
  await firstMemberOption.waitFor({ state: 'attached', timeout: 10000 });
  const memberLabel = (await firstMemberOption.textContent())!.trim();
  await assigneeSelect.selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  // Le nom du membre assigné est visible sur la carte
  await expect(getTaskCard(page, subject).getByText(memberLabel)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

test('supprime une tâche', async ({ page, createTask }) => {
  const subject = `Suppression E2E ${Date.now()}`;
  await createTask(subject);

  await openTaskMenu(page, subject);
  await page.getByRole('menuitem', { name: 'Supprimer' }).click();

  await expect(page.getByText(subject)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Changement de statut
// ---------------------------------------------------------------------------

test('change le statut d\'une tâche vers "En cours"', async ({ page, createTask }) => {
  const subject = `Statut E2E ${Date.now()}`;
  await createTask(subject);

  const card = getTaskCard(page, subject);
  await card.getByRole('button', { name: 'À faire', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'En cours' }).click();

  await expect(card.getByRole('button', { name: 'En cours', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Filtrage
// ---------------------------------------------------------------------------

test('filtre les tâches par statut', async ({ page, createTask }) => {
  const pendingSubject = `Filtre À faire ${Date.now()}`;
  const inProgressSubject = `Filtre En cours ${Date.now()}`;

  await createTask(pendingSubject);
  await createTask(inProgressSubject);

  // Passer la deuxième tâche en "En cours"
  const card = getTaskCard(page, inProgressSubject);
  await card.getByRole('button', { name: 'À faire', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'En cours' }).click();
  await expect(card.getByRole('button', { name: 'En cours', exact: true })).toBeVisible();

  // Appliquer le filtre "En cours"
  // Les pills de filtre sont en tête de DOM, avant les cartes → .first() cible le pill
  await page.getByRole('button', { name: 'En cours', exact: true }).first().click();

  await expect(page.getByText(inProgressSubject)).toBeVisible();
  await expect(page.getByText(pendingSubject)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Détail
// ---------------------------------------------------------------------------

test('ouvre le dialog de détail d\'une tâche', async ({ page, createTask }) => {
  const subject = `Détail E2E ${Date.now()}`;
  await createTask(subject);

  await page.getByRole('button', { name: subject, exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(subject)).toBeVisible();
});

test('change le statut depuis le dialog de détail', async ({ page, createTask }) => {
  const subject = `Détail Statut E2E ${Date.now()}`;
  await createTask(subject);

  await page.getByRole('button', { name: subject, exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'À faire', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'En cours' }).click();

  // Fermer le dialog et vérifier la carte
  await page.keyboard.press('Escape');
  await expect(getTaskCard(page, subject).getByRole('button', { name: 'En cours', exact: true })).toBeVisible();
});

test('modifie une tâche depuis le dialog de détail', async ({ page, createTask }) => {
  const subject = `Détail Modif E2E ${Date.now()}`;
  await createTask(subject);

  await page.getByRole('button', { name: subject, exact: true }).click();

  await page.getByRole('dialog').getByRole('button', { name: 'Modifier' }).click();

  const editDialog = page.getByRole('dialog');
  const subjectInput = editDialog.getByPlaceholder('Titre de la tâche…');
  await subjectInput.clear();
  await subjectInput.fill(`${subject} — depuis détail`);
  await editDialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText(`${subject} — depuis détail`)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Permissions : l'assigné peut changer le statut mais pas modifier
// ---------------------------------------------------------------------------

test.describe('en tant qu\'assigné (antoine)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('peut changer le statut d\'une tâche qui lui est assignée', async ({ page, loginAs }) => {
    await loginAs('antoine.mercier@demo.local', 'demo1234');
    await page.goto('/app/tasks');

    // "Commander la douche à l'italienne" : créée par claire, assignée à antoine
    const subject = 'Commander la douche à l\'italienne';
    const card = getTaskCard(page, subject);

    const statusBtn = card.getByRole('button', { name: 'En cours', exact: true });
    await expect(statusBtn).toBeEnabled();
    await statusBtn.click();
    await page.getByRole('menuitemradio', { name: 'À faire' }).click();
    await expect(card.getByRole('button', { name: 'À faire', exact: true })).toBeVisible();

    // Remettre en état initial
    await card.getByRole('button', { name: 'À faire', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'En cours' }).click();
  });
});
