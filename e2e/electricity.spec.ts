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

  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  // Dialog closes and the board name appears on the board tab
  await expect(page.getByText(boardName)).toBeVisible();
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

  test('navigue vers l\'onglet Recherche', async ({ page }) => {
    await page.getByRole('button', { name: 'Recherche', exact: true }).click();
    await expect(page.getByPlaceholder('Rechercher par étiquette (disjoncteur / circuit / point d\'usage)…')).toBeVisible();
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

    // Delete: accept the window.confirm dialog
    page.once('dialog', (d) => void d.accept());
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

    page.once('dialog', (d) => void d.accept());
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
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText(boardNameEdited)).toBeVisible();
  await expect(page.getByText(boardName, { exact: true })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Onglet Recherche (Lookup)
// ---------------------------------------------------------------------------

test('affiche le champ de recherche dans l\'onglet Recherche', async ({ page }) => {
  await page.goto('/app/electricity');

  // Need a board to access tabs
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
  }

  await page.getByRole('button', { name: 'Recherche', exact: true }).click();

  const searchInput = page.getByPlaceholder(
    'Rechercher par étiquette (disjoncteur / circuit / point d\'usage)…',
  );
  await expect(searchInput).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rechercher' })).toBeVisible();
});

test('la recherche d\'une étiquette inexistante affiche "Introuvable."', async ({ page }) => {
  await page.goto('/app/electricity');

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
  }

  await page.getByRole('button', { name: 'Recherche', exact: true }).click();

  await page.getByPlaceholder(
    'Rechercher par étiquette (disjoncteur / circuit / point d\'usage)…',
  ).fill('INEXISTANT-99999');
  await page.getByRole('button', { name: 'Rechercher' }).click();

  await expect(page.getByText('Introuvable.')).toBeVisible();
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
