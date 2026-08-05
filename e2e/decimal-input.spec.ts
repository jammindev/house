import { test, expect } from '@playwright/test';

/**
 * Régression #448 — un montant se saisit à la virgule.
 *
 * **Ce test est ici et pas en vitest parce que le bug n'existait que dans un vrai
 * moteur.** `<input type="number">` refuse le séparateur de la locale : la valeur
 * lue devenait tronquée, React la réécrivait dans le champ et détruisait le
 * tampon de saisie. Taper `1` `2` `,` `5` donnait **512** sur Chromium, `5` sur
 * Safari et Firefox — un montant faux, sans le moindre message. jsdom ne
 * reproduit pas cette sanitisation : seul le navigateur pouvait attester le fix.
 *
 * D'où la frappe **touche à touche** (`pressSequentially`) : un `fill()` écrit la
 * valeur d'un coup et passe à côté du bug, comme les tests existants.
 */

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/** Part d'un onglet Budgets vide — la card créée doit être identifiable. */
async function deleteAllBudgets(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/budget/budgets/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = (await resp.json()) as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/budget/budgets/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

test.describe('Champs décimaux — la virgule du clavier français', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/money/budgets');
    await expect(page).toHaveURL(/\/app\/money/);
    await deleteAllBudgets(page);
    await page.reload();
  });

  test('un plafond tapé « 12,5 » vaut 12,50 € — et non 512 €', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau budget' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#budget-name').fill('Virgule');

    const amount = dialog.locator('#budget-amount');
    await amount.click();
    // Touche à touche, et la virgule en **événement clavier** : c'est ce chemin-là
    // qui produisait 512, là où un `pressSequentially` passe par l'insertion de
    // texte et ne voyait qu'un séparateur mal affiché.
    for (const key of ['1', '2', 'Comma', '5']) {
      await page.keyboard.press(key);
    }

    // Ce que l'utilisateur voit : sa frappe, dans le séparateur de sa locale.
    await expect(amount).toHaveValue('12,5');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();

    // Ce que le foyer a enregistré : douze euros cinquante.
    await expect(page.getByText('Virgule', { exact: true })).toBeVisible();
    await expect(page.getByText(/12,50/).first()).toBeVisible();
    await expect(page.getByText(/512/)).toHaveCount(0);
  });

  test('le point reste accepté sur le même champ — pavé numérique, copier-coller', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Nouveau budget' }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('#budget-name').fill('Point');

    const amount = dialog.locator('#budget-amount');
    await amount.click();
    await amount.pressSequentially('12.5');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/12,50/).first()).toBeVisible();
  });

  test('rouvrir le budget réaffiche le plafond dans la locale', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau budget' }).first().click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#budget-name').fill('Relecture');
    await dialog.locator('#budget-amount').click();
    await dialog.locator('#budget-amount').pressSequentially('12,5');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();

    const card = page.getByText('Relecture', { exact: true }).locator('xpath=ancestor::*[3]');
    await card.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#budget-amount')).toHaveValue('12,50');
  });
});
