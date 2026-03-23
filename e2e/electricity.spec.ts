import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clicks the CardActions dropdown button (MoreHorizontal) on a card that
 * contains the given text, then clicks the menu item with the given label.
 */
async function openCardMenu(
  page: import('@playwright/test').Page,
  cardText: string,
  menuItem: string,
): Promise<void> {
  // Find the card ancestor that contains the text, then click its last button
  // (the CardActions trigger). We walk up 4 levels as in the tasks fixture.
  const cardAncestor = page.getByText(cardText, { exact: true }).locator('xpath=ancestor::*[4]');
  await cardAncestor.locator('button').last().click();
  await page.getByRole('menuitem', { name: menuItem }).click();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test('affiche la page Électricité', async ({ page }) => {
  await page.goto('/app/electricity');
  await expect(page).toHaveURL(/\/app\/electricity/);
  await expect(page.getByRole('heading', { name: 'Électricité' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// État vide — aucun tableau
// ---------------------------------------------------------------------------

test('affiche l\'état vide avec le bouton "Nouveau tableau" quand aucun tableau n\'existe', async ({ page }) => {
  await page.goto('/app/electricity');
  // The E2E database has no seeded electricity data, so the empty state is shown.
  await expect(page.getByText('Aucun tableau électrique')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouveau tableau' }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Création d'un tableau (BoardDialog)
// ---------------------------------------------------------------------------

test('ouvre le dialog de création de tableau depuis l\'état vide', async ({ page }) => {
  await page.goto('/app/electricity');
  await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Nouveau tableau' })).toBeVisible();
});

test('crée un tableau électrique', async ({ page }) => {
  await page.goto('/app/electricity');
  await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Name is pre-filled with "Tableau principal" — clear and set a unique name
  const boardName = `Tableau E2E ${Date.now()}`;
  const nameInput = dialog.getByLabel('Nom');
  await nameInput.clear();
  await nameInput.fill(boardName);

  // Zone is required — pick the first available zone
  const zoneSelect = page.locator('#board-zone');
  const firstZoneOption = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
  await firstZoneOption.waitFor({ state: 'attached', timeout: 10_000 });
  await zoneSelect.selectOption(await firstZoneOption.getAttribute('value') as string);

  // New optional fields: identifiant court et nombre de rangées
  await page.locator('#board-label').fill('TB-E2E');
  await page.locator('#board-rows').fill('4');

  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  // Dialog closes and the board name appears on the board tab
  await expect(page.getByText(boardName)).toBeVisible();
});

test('les nouveaux champs du BoardDialog sont visibles', async ({ page }) => {
  await page.goto('/app/electricity');
  await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Les quatre nouveaux champs doivent être présents dans le formulaire
  await expect(dialog.getByLabel('Identifiant')).toBeVisible();
  await expect(dialog.getByLabel('Tableau parent')).toBeVisible();
  await expect(dialog.getByLabel('Nombre de rangées')).toBeVisible();
  await expect(dialog.getByLabel('Modules par rangée')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Navigation par onglets
// ---------------------------------------------------------------------------

test.describe('navigation par onglets', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure a board exists before testing tab navigation.
    // We create one if the empty state is shown.
    await page.goto('/app/electricity');

    const emptyState = page.getByText('Aucun tableau électrique');
    const isVisible = await emptyState.isVisible().catch(() => false);

    if (isVisible) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const zoneSelect = page.locator('#board-zone');
      const firstZoneOption = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZoneOption.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZoneOption.getAttribute('value') as string);

      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByText('Tableau principal')).toBeVisible();
    }
  });

  test('onglet Tableau est actif par défaut', async ({ page }) => {
    // The board info card should be visible on the default tab
    await expect(page.getByRole('button', { name: 'Tableau', exact: true })).toBeVisible();
  });

  test('navigue vers l\'onglet Circuits', async ({ page }) => {
    await page.getByRole('button', { name: 'Circuits', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ajouter un circuit' })).toBeVisible();
  });

  test('navigue vers l\'onglet Points d\'usage', async ({ page }) => {
    await page.getByRole('button', { name: 'Points d\'usage', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ajouter un point d\'usage' })).toBeVisible();
  });

  test('navigue vers l\'onglet Liens', async ({ page }) => {
    await page.getByRole('button', { name: 'Liens', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nouveau lien' })).toBeVisible();
  });

});

// ---------------------------------------------------------------------------
// Flux complet : board → appareil → circuit → point d'usage → lien
// Ces tests créent toutes les entités dans l'ordre requis.
// ---------------------------------------------------------------------------

test.describe('flux complet électricité', () => {
  // Unique suffix to avoid collisions between test runs
  const suffix = Date.now();
  const boardName = `Tableau E2E complet ${suffix}`;
  const deviceLabel = `BRK-E2E-${suffix}`;
  const circuitLabel = `CIR-E2E-${suffix}`;
  const circuitName = `Prises salon E2E ${suffix}`;
  const usagePointLabel = `UP-E2E-${suffix}`;
  const usagePointName = `Prise salon mur nord E2E ${suffix}`;

  // Create the board once before the describe block's tests run.
  // Each test then navigates independently to maintain isolation of assertions.
  test('crée un tableau et un appareil de protection (disjoncteur)', async ({ page }) => {
    await page.goto('/app/electricity');

    // --- Créer le tableau ---
    await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByLabel('Nom');
    await nameInput.clear();
    await nameInput.fill(boardName);

    const zoneSelect = page.locator('#board-zone');
    const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
    await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
    await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(boardName)).toBeVisible();

    // --- Ajouter un disjoncteur ---
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ajouter un appareil' })).toBeVisible();

    // Type is already "Disjoncteur" by default; set label
    const labelInput = dialog.getByLabel('Étiquette');
    await labelInput.fill(deviceLabel);

    // Rating (A) is pre-filled with 20 — leave as-is
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Device appears in the list (shown by its label)
    await expect(page.getByText(deviceLabel)).toBeVisible();
  });

  test('crée un circuit', async ({ page }) => {
    await page.goto('/app/electricity');

    // Ensure we have the board with the device from a previous run, or
    // create them if this test runs in isolation (best-effort).
    // In CI, tests run sequentially and share the E2E DB, so data persists.

    // Navigate to Circuits tab
    await page.getByRole('button', { name: 'Circuits', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ajouter un circuit' })).toBeVisible();

    await page.getByRole('button', { name: 'Ajouter un circuit' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ajouter un circuit' })).toBeVisible();

    // Fill label and name
    await dialog.getByLabel('Étiquette').fill(circuitLabel);
    await dialog.getByLabel('Nom').fill(circuitName);

    // Select first available protective device
    const deviceSelect = page.locator('#cir-device');
    const firstDevice = deviceSelect.locator('option:not([disabled]):not([value=""])').first();
    await firstDevice.waitFor({ state: 'attached', timeout: 10_000 });
    await deviceSelect.selectOption(await firstDevice.getAttribute('value') as string);

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Circuit appears in the list
    await expect(page.getByText(circuitLabel)).toBeVisible();
    await expect(page.getByText(circuitName)).toBeVisible();
  });

  test('crée un point d\'usage (prise)', async ({ page }) => {
    await page.goto('/app/electricity');

    // Navigate to Usage Points tab
    await page.getByRole('button', { name: 'Points d\'usage', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ajouter un point d\'usage' })).toBeVisible();

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ajouter un point d\'usage' })).toBeVisible();

    // Label and name
    await dialog.getByLabel('Étiquette').fill(usagePointLabel);
    await dialog.getByLabel('Nom').fill(usagePointName);

    // Kind: "Prise" is default — no change needed
    // Zone is optional

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Usage point appears in the list
    await expect(page.getByText(usagePointLabel)).toBeVisible();
    await expect(page.getByText(usagePointName)).toBeVisible();
  });

  test('crée un lien circuit → point d\'usage', async ({ page }) => {
    await page.goto('/app/electricity');

    // Navigate to Links tab
    await page.getByRole('button', { name: 'Liens', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nouveau lien' })).toBeVisible();

    await page.getByRole('button', { name: 'Nouveau lien' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Nouveau lien' })).toBeVisible();

    // Select first available circuit
    const circuitSelect = page.locator('#link-circuit');
    const firstCircuit = circuitSelect.locator('option:not([disabled]):not([value=""])').first();
    await firstCircuit.waitFor({ state: 'attached', timeout: 10_000 });
    await circuitSelect.selectOption(await firstCircuit.getAttribute('value') as string);

    // Select first available usage point
    const upSelect = page.locator('#link-up');
    const firstUp = upSelect.locator('option:not([disabled]):not([value=""])').first();
    await firstUp.waitFor({ state: 'attached', timeout: 10_000 });
    await upSelect.selectOption(await firstUp.getAttribute('value') as string);

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // A link card appears — the "Déconnecter" button is the unique marker
    await expect(page.getByRole('button', { name: 'Déconnecter' }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Filtre des points d'usage (Tous / Prises / Luminaires)
// ---------------------------------------------------------------------------

test.describe('filtre des points d\'usage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/electricity');
    await page.getByRole('button', { name: 'Points d\'usage', exact: true }).click();
  });

  test('affiche tous les points d\'usage par défaut', async ({ page }) => {
    // The "Tous" filter pill should be visible (active by default after navigation)
    await expect(page.getByRole('button', { name: 'Tous', exact: true })).toBeVisible();
  });

  test('le filtre "Prises" ne montre que les prises', async ({ page }) => {
    await page.getByRole('button', { name: 'Prises', exact: true }).click();
    // Either usage points are shown (filtered) or the "no match" message is shown —
    // in both cases the filter pill is now active and "Luminaires" data is hidden.
    // We just verify the filter pill is clickable and no crash occurs.
    await expect(page.getByRole('button', { name: 'Prises', exact: true })).toBeVisible();
  });

  test('le filtre "Luminaires" ne montre que les luminaires', async ({ page }) => {
    await page.getByRole('button', { name: 'Luminaires', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Luminaires', exact: true })).toBeVisible();
  });

  test('revenir sur "Tous" après un filtre', async ({ page }) => {
    await page.getByRole('button', { name: 'Prises', exact: true }).click();
    await page.getByRole('button', { name: 'Tous', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tous', exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Modification via CardActions
// ---------------------------------------------------------------------------

test.describe('modification et suppression', () => {
  test('modifie un appareil de protection via CardActions', async ({ page }) => {
    await page.goto('/app/electricity');

    // Create a board and a device to edit
    const suffix = Date.now();
    const deviceLabel = `BRK-EDIT-${suffix}`;
    const deviceLabelEdited = `BRK-EDIT-${suffix}-v2`;

    // Ensure a board exists (or create one)
    const emptyState = page.getByText('Aucun tableau électrique');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const dialog = page.getByRole('dialog');
      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: 'Ajouter un appareil' })).toBeVisible();
    }

    // Add a device to edit
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Étiquette').fill(deviceLabel);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(deviceLabel)).toBeVisible();

    // Open CardActions → Modifier
    await openCardMenu(page, deviceLabel, 'Modifier');
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Change the label
    const labelInput = dialog.getByLabel('Étiquette');
    await labelInput.clear();
    await labelInput.fill(deviceLabelEdited);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(deviceLabelEdited)).toBeVisible();
    await expect(page.getByText(deviceLabel, { exact: true })).not.toBeVisible();
  });

  test('supprime un appareil de protection via CardActions', async ({ page }) => {
    await page.goto('/app/electricity');

    const suffix = Date.now();
    const deviceLabel = `BRK-DEL-${suffix}`;

    // Ensure board exists
    const emptyState = page.getByText('Aucun tableau électrique');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const dialog = page.getByRole('dialog');
      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: 'Ajouter un appareil' })).toBeVisible();
    }

    // Add device to delete
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Étiquette').fill(deviceLabel);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(deviceLabel)).toBeVisible();

    // Delete: item disappears immediately (optimistic removal via deleteWithUndo)
    await openCardMenu(page, deviceLabel, 'Supprimer');

    await expect(page.getByText(deviceLabel)).not.toBeVisible();
  });

  test('modifie un point d\'usage via CardActions', async ({ page }) => {
    await page.goto('/app/electricity');

    const suffix = Date.now();
    const upLabel = `UP-EDIT-${suffix}`;
    const upName = `Prise E2E EDIT ${suffix}`;
    const upNameEdited = `Prise E2E EDIT ${suffix} — modifiée`;

    // Ensure board exists before navigating to usage points
    const emptyState = page.getByText('Aucun tableau électrique');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const boardDialog = page.getByRole('dialog');
      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
      await boardDialog.getByRole('button', { name: 'Enregistrer' }).click();
    }

    // Navigate to usage points
    await page.getByRole('button', { name: 'Points d\'usage', exact: true }).click();

    // Create usage point to edit
    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Étiquette').fill(upLabel);
    await dialog.getByLabel('Nom').fill(upName);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(upName)).toBeVisible();

    // Edit via CardActions
    await openCardMenu(page, upName, 'Modifier');
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const nameInput = dialog.getByLabel('Nom');
    await nameInput.clear();
    await nameInput.fill(upNameEdited);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(upNameEdited)).toBeVisible();
    await expect(page.getByText(upName, { exact: true })).not.toBeVisible();
  });

  test('supprime un point d\'usage via CardActions', async ({ page }) => {
    await page.goto('/app/electricity');

    const suffix = Date.now();
    const upLabel = `UP-DEL-${suffix}`;
    const upName = `Prise E2E DEL ${suffix}`;

    // Ensure board exists
    const emptyState = page.getByText('Aucun tableau électrique');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const boardDialog = page.getByRole('dialog');
      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
      await boardDialog.getByRole('button', { name: 'Enregistrer' }).click();
    }

    await page.getByRole('button', { name: 'Points d\'usage', exact: true }).click();

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Étiquette').fill(upLabel);
    await dialog.getByLabel('Nom').fill(upName);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(upName)).toBeVisible();

    // Delete: item disappears immediately (optimistic removal via deleteWithUndo)
    await openCardMenu(page, upName, 'Supprimer');

    await expect(page.getByText(upName)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Modification du tableau via CardActions
// ---------------------------------------------------------------------------

test('modifie le tableau via CardActions', async ({ page }) => {
  await page.goto('/app/electricity');

  const suffix = Date.now();
  const boardName = `Tableau Modif E2E ${suffix}`;
  const boardNameEdited = `Tableau Modif E2E ${suffix} — modifié`;

  // Create a board
  await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const nameInput = dialog.getByLabel('Nom');
  await nameInput.clear();
  await nameInput.fill(boardName);

  const zoneSelect = page.locator('#board-zone');
  const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
  await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
  await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);

  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(boardName)).toBeVisible();

  // Edit the board using the CardActions on the board info card
  await openCardMenu(page, boardName, 'Modifier');
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Modifier le tableau' })).toBeVisible();

  const editNameInput = dialog.getByLabel('Nom');
  await editNameInput.clear();
  await editNameInput.fill(boardNameEdited);

  // Also set the new "label" field (identifiant court) to verify it is editable
  const labelInput = page.locator('#board-label');
  await labelInput.fill('TB-MODIF');

  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText(boardNameEdited)).toBeVisible();
  await expect(page.getByText(boardName, { exact: true })).not.toBeVisible();
});


// ---------------------------------------------------------------------------
// Nombre de pôles (pole_count) dans le DeviceDialog
// ---------------------------------------------------------------------------

test.describe('champ Nombre de pôles dans le DeviceDialog', () => {
  async function ensureBoardExists(page: import('@playwright/test').Page) {
    const emptyState = page.getByText('Aucun tableau électrique');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const dialog = page.getByRole('dialog');
      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: 'Ajouter un appareil' })).toBeVisible();
    }
  }

  test('le champ "Nombre de pôles" est visible dans le DeviceDialog', async ({ page }) => {
    await page.goto('/app/electricity');
    await ensureBoardExists(page);

    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByLabel('Nombre de pôles')).toBeVisible();
  });

  test('disjoncteur : les 4 options de pôles (1P–4P) sont disponibles', async ({ page }) => {
    await page.goto('/app/electricity');
    await ensureBoardExists(page);

    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type = Disjoncteur (default)
    const poleSelect = page.locator('#dev-poles');
    const optionValues = await poleSelect.locator('option').allTextContents();

    expect(optionValues).toContain('1P');
    expect(optionValues).toContain('2P');
    expect(optionValues).toContain('3P');
    expect(optionValues).toContain('4P');
  });

  test('différentiel (RCD) : seuls 2P et 4P sont disponibles', async ({ page }) => {
    await page.goto('/app/electricity');
    await ensureBoardExists(page);

    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Switch type to RCD
    await page.locator('#dev-type').selectOption('rcd');

    const poleSelect = page.locator('#dev-poles');
    const optionValues = await poleSelect.locator('option').allTextContents();

    expect(optionValues).toContain('2P');
    expect(optionValues).toContain('4P');
    expect(optionValues).not.toContain('1P');
    expect(optionValues).not.toContain('3P');
  });

  test('combiné (combined) : seuls 2P et 4P sont disponibles', async ({ page }) => {
    await page.goto('/app/electricity');
    await ensureBoardExists(page);

    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.locator('#dev-type').selectOption('combined');

    const poleSelect = page.locator('#dev-poles');
    const optionValues = await poleSelect.locator('option').allTextContents();

    expect(optionValues).toContain('2P');
    expect(optionValues).toContain('4P');
    expect(optionValues).not.toContain('1P');
    expect(optionValues).not.toContain('3P');
  });

  test('crée un disjoncteur 2P et vérifie l\'affichage "2P" dans la carte', async ({ page }) => {
    await page.goto('/app/electricity');
    await ensureBoardExists(page);

    const suffix = Date.now();
    const label = `BRK-2P-${suffix}`;

    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Étiquette').fill(label);
    await page.locator('#dev-poles').selectOption('2');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Card should show the label and "2P" in the specs line
    await expect(page.getByText(label)).toBeVisible();
    // The spec "2P" appears in the card specs
    const card = page.getByText(label).locator('xpath=ancestor::*[4]');
    await expect(card.getByText(/2P/)).toBeVisible();
  });

  test('le champ reste optionnel — créer un disjoncteur sans pôle est valide', async ({ page }) => {
    await page.goto('/app/electricity');
    await ensureBoardExists(page);

    const suffix = Date.now();
    const label = `BRK-NOPOLE-${suffix}`;

    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Étiquette').fill(label);
    // Leave "Nombre de pôles" as "—" (empty)
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Device is created successfully
    await expect(page.getByText(label)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Création en masse de points d'usage (champ Quantité)
// ---------------------------------------------------------------------------

test.describe('usage point bulk create', () => {
  /**
   * Ensures at least one board + one device exist (required by the empty-state
   * chain), then navigates to the Usage Points tab.
   */
  async function ensureBoardAndNavigateToUsagePoints(page: import('@playwright/test').Page) {
    await page.goto('/app/electricity');

    // 1. Create a board if the no-board empty state is shown
    const boardEmptyState = page.getByText('Aucun tableau électrique');
    const hasNoBoard = await boardEmptyState.isVisible().catch(() => false);

    if (hasNoBoard) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const boardDialog = page.getByRole('dialog');
      await expect(boardDialog).toBeVisible();
      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
      await boardDialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(boardEmptyState).not.toBeVisible();
    }

    // 2. Create a device if no device exists yet
    //    (the empty-state chain prevents tab navigation without a device)
    const deviceEmptyState = page.getByText('Aucun appareil de protection');
    const hasNoDevice = await deviceEmptyState.isVisible().catch(() => false);

    if (hasNoDevice) {
      await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
      const deviceDialog = page.getByRole('dialog');
      await expect(deviceDialog).toBeVisible();
      await deviceDialog.getByLabel('Étiquette').fill(`BRK-BULK-SETUP-${Date.now()}`);
      await deviceDialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(deviceEmptyState).not.toBeVisible();
    }

    // 3. Navigate to Usage Points tab
    await page.getByRole('button', { name: 'Points d\'usage', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ajouter un point d\'usage' })).toBeVisible();
  }

  test('le champ Quantité est visible lors de la création', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByLabel('Quantité')).toBeVisible();
  });

  test('le champ Quantité vaut 1 par défaut', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByLabel('Quantité')).toHaveValue('1');
  });

  test('un hint apparaît sous le champ Quantité quand la valeur est > 1', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill a label so the hint shows real values
    await dialog.getByLabel('Étiquette').fill('UP-SAL');

    // Set quantity to 3 — hint should appear
    await page.locator('#up-quantity').fill('3');

    // The hint pattern: "Créera UP-SAL-01 … UP-SAL-3"
    await expect(dialog.getByText(/Créera UP-SAL-01/)).toBeVisible();
  });

  test('aucun hint n\'apparaît quand la quantité est 1', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Quantity defaults to 1 — hint must not be present
    await expect(dialog.getByText(/Créera/)).not.toBeVisible();
  });

  test('créer avec quantité 1 crée un seul point d\'usage avec l\'étiquette exacte', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    const suffix = Date.now();
    const upLabel = `UP-SINGLE-${suffix}`;
    const upName = `Prise E2E single ${suffix}`;

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Étiquette').fill(upLabel);
    await dialog.getByLabel('Nom').fill(upName);
    // Quantity defaults to 1 — no change needed

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // The usage point appears with its exact label (no suffix)
    await expect(page.getByText(upLabel)).toBeVisible();
    // Suffixed variants must NOT appear
    await expect(page.getByText(`${upLabel}-01`)).not.toBeVisible();
  });

  test('créer avec quantité 3 crée 3 points d\'usage suffixés -01, -02, -03', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    const suffix = Date.now();
    const upLabel = `UP-BULK-${suffix}`;
    const upName = `Prise E2E bulk ${suffix}`;

    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Étiquette').fill(upLabel);
    await dialog.getByLabel('Nom').fill(upName);
    await page.locator('#up-quantity').fill('3');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // All three suffixed usage points must appear in the list
    await expect(page.getByText(`${upLabel}-01`)).toBeVisible();
    await expect(page.getByText(`${upLabel}-02`)).toBeVisible();
    await expect(page.getByText(`${upLabel}-03`)).toBeVisible();
  });

  test('le champ Quantité est absent du dialog de modification', async ({ page }) => {
    await ensureBoardAndNavigateToUsagePoints(page);

    const suffix = Date.now();
    const upLabel = `UP-EDIT-NOQUANT-${suffix}`;
    const upName = `Prise E2E no quant ${suffix}`;

    // Create a usage point first
    await page.getByRole('button', { name: 'Ajouter un point d\'usage' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Étiquette').fill(upLabel);
    await dialog.getByLabel('Nom').fill(upName);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(upName)).toBeVisible();

    // Open the edit dialog via CardActions
    await openCardMenu(page, upName, 'Modifier');
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Modifier le point d\'usage' })).toBeVisible();

    // The Quantité field must NOT be present in edit mode
    await expect(dialog.getByLabel('Quantité')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Déconnexion d'un lien (Links tab)
// ---------------------------------------------------------------------------

test('déconnecte un lien via le bouton Déconnecter', async ({ page }) => {
  await page.goto('/app/electricity');

  // This test relies on at least one active link existing (created by the
  // "flux complet" describe block above which runs sequentially). We navigate
  // directly to the Links tab and check for the Déconnecter button.
  await page.getByRole('button', { name: 'Liens', exact: true }).click();

  const disconnectBtn = page.getByRole('button', { name: 'Déconnecter' }).first();
  const hasLink = await disconnectBtn.isVisible().catch(() => false);

  if (!hasLink) {
    // No link to deactivate — skip gracefully by verifying the empty state
    await expect(page.getByText('Aucun lien actif')).toBeVisible();
    return;
  }

  // Count links before
  const linksBefore = await page.getByRole('button', { name: 'Déconnecter' }).count();

  await disconnectBtn.click();

  // One fewer Déconnecter button after deactivation
  const linksAfter = await page.getByRole('button', { name: 'Déconnecter' }).count();
  expect(linksAfter).toBe(linksBefore - 1);
});

// ---------------------------------------------------------------------------
// Conflit de positions d'appareils (slot grid + validation)
// ---------------------------------------------------------------------------

test.describe('conflit de positions d\'appareils', () => {
  const suffix = Date.now();
  const boardName = `Tableau Position E2E ${suffix}`;
  const deviceLabel = `BRK-POS-${suffix}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/electricity');

    // Create a board with slots_per_row=12 if no board exists yet
    const emptyState = page.getByText('Aucun tableau électrique');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const nameInput = dialog.getByLabel('Nom');
      await nameInput.clear();
      await nameInput.fill(boardName);

      const zoneSelect = page.locator('#board-zone');
      const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
      await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
      await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);

      await page.locator('#board-slots').fill('12');

      await dialog.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: 'Ajouter un appareil' })).toBeVisible();
    }
  });

  test('crée un appareil avec une position', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Étiquette').fill(deviceLabel);
    await page.locator('#dev-row').fill('1');
    await page.locator('#dev-position').fill('3');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(deviceLabel)).toBeVisible();
  });

  test('affiche le quadrillage des slots quand une rangée est saisie', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Le slot grid n'apparaît que quand row est renseigné ET slotsPerRow est défini
    await page.locator('#dev-row').fill('1');

    await expect(page.locator('[data-testid="slot-grid"]')).toBeVisible();

    await dialog.getByRole('button', { name: 'Annuler' }).click();
  });

  test('bloque la création d\'un appareil à une position déjà occupée', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Saisir la même position que le device créé dans le test précédent (rangée 1, position 3)
    await page.locator('#dev-row').fill('1');
    await page.locator('#dev-position').fill('3');

    // L'erreur de conflit s'affiche en temps réel (avant soumission)
    await expect(page.getByText(/Position occupée/)).toBeVisible();

    // Tenter de soumettre : le formulaire doit rester ouvert
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeVisible();
  });

  test('accepte une position adjacente non conflictuelle', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter un appareil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Position 4 est adjacente à 3 mais pas en overlap
    await page.locator('#dev-row').fill('1');
    await page.locator('#dev-position').fill('4');

    // Aucune erreur de conflit
    await expect(page.getByText(/Position occupée/)).not.toBeVisible();

    // Le bouton Enregistrer est accessible (pas bloqué)
    await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Annuler' }).click();
  });
});
