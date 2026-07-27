import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * ZonePicker — le sélecteur de zones commun à toute l'application.
 *
 * Testé **hors** de la page Zones, sur de vrais formulaires consommateurs, parce
 * que c'est là que les quatre anciens patterns vivaient : un picker qui ne
 * marche que dans son propre écran n'aurait rien unifié.
 *
 *  - mode simple avec « aucune zone »  → dialog Équipement
 *  - mode simple requis                → page Nouvelle interaction
 *  - mode multiple                     → dialog Nouvelle tâche
 *  - recherche + hiérarchie            → dialog Équipement
 *  - exclusion des descendants         → dialog Zone (champ « Zone parente »)
 */

interface ApiZone {
  id: string;
  name: string;
  parent: string | null;
}

async function apiCreateZone(
  page: Page,
  opts: { name: string; parent?: string | null },
): Promise<ApiZone> {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  const resp = await page.request.post('/api/zones/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name: opts.name, parent: opts.parent ?? null, color: '#60A5FA' },
  });
  if (!resp.ok()) {
    throw new Error(`apiCreateZone failed (${resp.status()}): ${await resp.text()}`);
  }
  return (await resp.json()) as ApiZone;
}

/** Le panneau flottant du picker. */
function panel(page: Page) {
  return page.getByRole('dialog', { name: 'Sélection de zones' });
}

test.describe('ZonePicker — le sélecteur commun', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/zones');
    await expect(page.getByRole('heading', { name: 'Zones' })).toBeVisible();
  });

  test('mode simple : choisir une zone met à jour le déclencheur et referme le panneau', async ({
    page,
  }) => {
    const ts = Date.now();
    const name = `Picker Simple ${ts}`;
    await apiCreateZone(page, { name });

    await page.goto('/app/equipment');
    await page.getByRole('button', { name: 'Nouveau', exact: true }).first().click();

    const trigger = page.locator('#eq-zone');
    await expect(trigger).toBeVisible();
    // Rien de choisi → le libellé « aucune zone » du formulaire d'origine.
    await expect(trigger).toContainText('Aucune zone');

    await trigger.click();
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name, exact: true }).click();

    // Choisir referme : en mode simple il n'y a rien à ajouter.
    await expect(panel(page)).toBeHidden();
    await expect(trigger).toContainText(name);
  });

  test('mode simple : la recherche filtre et conserve le parent du résultat', async ({ page }) => {
    const ts = Date.now();
    const parentName = `Etage Picker ${ts}`;
    const childName = `Cagibi Picker ${ts}`;
    const otherName = `Hangar Picker ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });
    await apiCreateZone(page, { name: otherName });

    await page.goto('/app/equipment');
    await page.getByRole('button', { name: 'Nouveau', exact: true }).first().click();
    await page.locator('#eq-zone').click();
    await expect(panel(page)).toBeVisible();

    await panel(page).getByRole('searchbox').fill(childName);

    // Le résultat et son ancêtre restent visibles, le hors-sujet disparaît.
    await expect(panel(page).getByText(childName, { exact: true })).toBeVisible();
    await expect(panel(page).getByText(parentName, { exact: true })).toBeVisible();
    await expect(panel(page).getByText(otherName, { exact: true })).toBeHidden();
  });

  test('mode simple : la recherche ignore les accents', async ({ page }) => {
    const ts = Date.now();
    const name = `Réserve Accent ${ts}`;
    await apiCreateZone(page, { name });

    await page.goto('/app/equipment');
    await page.getByRole('button', { name: 'Nouveau', exact: true }).first().click();
    await page.locator('#eq-zone').click();
    await panel(page).getByRole('searchbox').fill(`reserve accent ${ts}`);

    await expect(panel(page).getByText(name, { exact: true })).toBeVisible();
  });

  test('mode multiple : cocher deux zones les liste et le panneau reste ouvert', async ({
    page,
  }) => {
    const ts = Date.now();
    const one = `Multi Un ${ts}`;
    const two = `Multi Deux ${ts}`;
    await apiCreateZone(page, { name: one });
    await apiCreateZone(page, { name: two });

    await page.goto('/app/tasks');
    await page.getByRole('button', { name: 'Nouvelle tâche', exact: true }).first().click();

    const trigger = page.locator('#task-zones');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(panel(page)).toBeVisible();

    // Le dialog Tâche présélectionne la racine du foyer : on compte en delta
    // plutôt qu'en absolu, pour ne rien présumer de l'état initial.
    const countSelected = () => panel(page).locator('button[aria-pressed="true"]').count();
    const before = await countSelected();

    await panel(page).getByRole('button', { name: one, exact: true }).click();
    // En multiple, le panneau ne se referme pas : on enchaîne les choix.
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name: two, exact: true }).click();

    await expect.poll(countSelected).toBe(before + 2);

    // Le déclencheur résume la sélection.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(trigger).toContainText(one);
    await expect(trigger).toContainText(two);
  });

  test('mode multiple : « Effacer » vide la sélection', async ({ page }) => {
    const ts = Date.now();
    const name = `Multi Vider ${ts}`;
    await apiCreateZone(page, { name });

    await page.goto('/app/tasks');
    await page.getByRole('button', { name: 'Nouvelle tâche', exact: true }).first().click();
    const trigger = page.locator('#task-zones');
    await trigger.click();
    const countSelected = () => panel(page).locator('button[aria-pressed="true"]').count();
    await panel(page).getByRole('button', { name, exact: true }).click();
    expect(await countSelected()).toBeGreaterThan(0);

    await panel(page).getByRole('button', { name: 'Effacer', exact: true }).click();
    await expect.poll(countSelected).toBe(0);
  });

  test('le panneau se ferme au clic extérieur et par Échap', async ({ page }) => {
    await page.goto('/app/equipment');
    await page.getByRole('button', { name: 'Nouveau', exact: true }).first().click();

    const trigger = page.locator('#eq-zone');
    await trigger.click();
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();

    await trigger.click();
    await expect(panel(page)).toBeVisible();
    // Clic sur un autre champ du même formulaire.
    await page.locator('#eq-name').click({ force: true });
    await expect(panel(page)).toBeHidden();
  });

  test('champ « Zone parente » : la zone éditée et ses descendants sont désactivés', async ({
    page,
  }) => {
    const ts = Date.now();
    const parentName = `Parent Cycle ${ts}`;
    const childName = `Enfant Cycle ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });

    await page.goto('/app/zones');
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();

    // Ouvrir l'édition de la zone parente via son menu ⋯.
    const row = page.getByText(parentName, { exact: true }).locator('xpath=ancestor::*[1]');
    await row.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    const dialog = page.getByRole('dialog', { name: 'Modifier la zone' });
    await expect(dialog).toBeVisible();
    await dialog.locator('#zone-parent').click();

    // Se choisir soi-même ou son propre enfant créerait un cycle : les deux
    // restent visibles (la hiérarchie doit rester lisible) mais désactivés.
    await expect(panel(page).getByRole('button', { name: parentName, exact: true })).toBeDisabled();
    await expect(panel(page).getByRole('button', { name: childName, exact: true })).toBeDisabled();
  });

  test('interaction : la zone est requise, le picker n\'offre pas « aucune zone »', async ({
    page,
  }) => {
    await page.goto('/app/interactions/new');

    const trigger = page.locator('#interaction-zone');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(panel(page)).toBeVisible();

    // Pas d'entrée « Aucune zone » : le champ est obligatoire côté API.
    await expect(panel(page).getByRole('button', { name: 'Aucune zone' })).toHaveCount(0);
  });
});
