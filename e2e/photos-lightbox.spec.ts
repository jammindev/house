import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, type Page } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PHOTO = path.resolve(__dirname, 'fixtures/test-photo.jpg');

const TOGGLE = 'Afficher ou masquer les informations';

/**
 * La visionneuse plein écran, et le geste qui la fonde : un tap sur la photo
 * retire le chrome, un second le ramène.
 *
 * **Pourquoi ce test vit dans un navigateur.** Le calque des commandes couvre
 * tout l'écran ; ne le neutraliser au pointeur que lorsqu'il est *caché* le
 * faisait avaler le tap tant qu'il était visible — le chrome ne pouvait donc
 * jamais être retiré. Les tests vitest passaient au vert : jsdom ne fait pas de
 * hit-testing, il livre l'événement au nœud visé sans se demander qui est
 * par-dessus. Même leçon que `decimal-input.spec.ts` : certains défauts
 * n'existent que là où il y a un moteur de rendu.
 */
async function openFirstPhoto(page: Page) {
  await page.goto('/app/photos');
  await page.waitForLoadState('networkidle');

  if ((await page.locator('main img').count()) === 0) {
    await page.getByRole('button', { name: 'Ajouter des photos' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#upload-file').setInputFiles(FIXTURE_PHOTO);
    await dialog.getByRole('button', { name: /Téléverser|Ajouter/ }).click();
    await expect(dialog).toBeHidden();
    await page.waitForLoadState('networkidle');
  }

  await page.locator('main img').first().click();
  await expect(page.getByRole('button', { name: TOGGLE })).toBeVisible();
}

test('le tap sur la photo retire le chrome, et le second le ramène', async ({ page }) => {
  await openFirstPhoto(page);

  const close = page.getByRole('button', { name: 'Fermer' });
  await expect(close).toBeVisible();

  await page.getByRole('button', { name: TOGGLE }).click();
  await expect(close).toBeHidden();

  await page.getByRole('button', { name: TOGGLE }).click();
  await expect(close).toBeVisible();
});

test('la photo occupe tout l’écran, sans cadre', async ({ page }) => {
  await openFirstPhoto(page);

  const viewport = page.viewportSize()!;
  const dialog = page.getByRole('dialog');
  const box = (await dialog.boundingBox())!;

  expect(box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);
});

test('la fermeture reste atteignable au doigt sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFirstPhoto(page);

  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
