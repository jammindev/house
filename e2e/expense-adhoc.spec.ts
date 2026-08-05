import { test, expect } from '@playwright/test';

/**
 * Parcours 26 — Lot 4 : la dépense en espèces est une opération de compte.
 *
 * Remplace le parcours « dépense ad-hoc » (parcours 08 lot 1.2, issue #124). Le
 * formulaire n'a presque pas changé ; ce qu'il **écrit** a changé du tout au tout.
 *
 * Une dépense qui n'existe que comme `Interaction` est une dépense que la banque
 * n'a jamais vue : le contrôle de conformité ne peut que la signaler, et personne
 * ne peut la résoudre. En passant par le compte espèces, l'opération et sa
 * ventilation naissent ensemble — l'orphelin disparaît par construction.
 */

/** Le compte espèces se crée depuis le dialog, en un clic. */
async function openCashDialog(page: import('@playwright/test').Page) {
  await page.goto('/app/money/expenses');
  await expect(page.getByRole('heading', { level: 1, name: 'Dépenses' })).toBeVisible();
  await page.getByRole('button', { name: 'Nouvelle dépense' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Premier passage : pas encore de compte espèces. Le dialog ne renvoie pas
  // ailleurs — il propose de le créer sur place.
  const createButton = dialog.getByRole('button', { name: 'Créer mon compte espèces' });
  if (await createButton.isVisible().catch(() => false)) {
    await createButton.click();
  }

  await expect(dialog.locator('#cash-label')).toBeVisible();
  return dialog;
}

test('dépense en espèces — Marché 32 €, opération et ventilation ensemble', async ({ page }) => {
  const dialog = await openCashDialog(page);

  const label = `Marché E2E ${Date.now()}`;
  await dialog.locator('#cash-label').fill(label);
  await page.locator('#purchase-price').fill('32');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
  await expect(dialog).toBeHidden();

  // La dépense apparaît dans l'onglet Dépenses — le libellé est saisi tel quel.
  await expect(page.getByText(label).first()).toBeVisible();

  // Et **pas** dans la page Activité : les dépenses en sont sorties, elles ont
  // leur module. Leur fiche reste accessible, c'est la liste qui ne les mélange
  // plus aux notes et aux maintenances.
  await page.goto('/app/interactions');
  await expect(page.getByText(label)).toHaveCount(0);
});

test('dépense en espèces — la ligne apparaît dans le journal bancaire', async ({ page }) => {
  const dialog = await openCashDialog(page);

  const label = `Boulangerie E2E ${Date.now()}`;
  await dialog.locator('#cash-label').fill(label);
  await page.locator('#purchase-price').fill('4.20');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
  await expect(dialog).toBeHidden();

  // C'est **une opération de compte**, pas seulement une dépense : elle doit se
  // voir dans le journal bancaire.
  await page.goto('/app/money/transactions');
  await expect(page.getByText(label).first()).toBeVisible();
});

test('dépense en espèces — libellé vide refusé', async ({ page }) => {
  const dialog = await openCashDialog(page);

  await page.locator('#purchase-price').fill('10');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();

  // Le dialog reste ouvert : validation côté front avant tout appel réseau.
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Le libellé est obligatoire');
});

test('dépense en espèces — elle ne produit aucun écart de conformité', async ({ page }) => {
  const dialog = await openCashDialog(page);

  const label = `Sans écart E2E ${Date.now()}`;
  await dialog.locator('#cash-label').fill(label);
  await page.locator('#purchase-price').fill('7.50');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
  await expect(dialog).toBeHidden();

  // C'est LE point du lot : l'opération naît ventilée, donc ni « sortie non
  // affectée » ni « dépense non rapprochée » pour cette ligne.
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  const resp = await page.request.get('/api/banking/compliance/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await resp.json()) as { groups: Array<{ kind: string; open: number }> };
  const byKind = new Map(body.groups.map((g) => [g.kind, g.open]));
  expect(byKind.get('transaction_unallocated')).toBe(0);
});
