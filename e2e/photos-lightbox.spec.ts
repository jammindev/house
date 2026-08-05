import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, type Page } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PHOTO = path.resolve(__dirname, 'fixtures/test-photo.jpg');
const FIXTURE_PHOTO_2 = path.resolve(__dirname, 'fixtures/test-photo-2.jpg');

const TOGGLE = 'Afficher ou masquer les informations';
/** Le pli de la card info : ce qui s'édite (titre, zones) attend ce clic. */
const EXPAND = "Plus d'informations";

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
async function openFirstPhoto(page: Page, atLeast = 1) {
  await page.goto('/app/photos');
  await page.waitForLoadState('networkidle');

  if ((await page.locator('main img').count()) < atLeast) {
    await page.getByRole('button', { name: 'Ajouter des photos' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#upload-file').setInputFiles([FIXTURE_PHOTO, FIXTURE_PHOTO_2]);
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

/**
 * Le pendant du test précédent : retirer ce qui *commente* la photo ne doit pas
 * retirer ce qui permet d'en *changer*. À la souris, tout cacher d'un bloc laissait
 * bloqué sur la photo courante — il fallait rappeler la card qu'on venait d'écarter.
 *
 * Ce comportement tient à `pointerType === 'mouse'` et à un minuteur : deux choses
 * qu'un vrai navigateur produit, et qu'un test jsdom ne peut que simuler.
 */
test('la souris rappelle la navigation, sans rappeler la card info', async ({ page }) => {
  await openFirstPhoto(page);

  await page.getByRole('button', { name: TOGGLE }).click();
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeHidden();

  await page.mouse.move(640, 400);
  await page.mouse.move(660, 420);

  await expect(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
  // La card info reste écartée : c'est tout l'objet du geste. Le témoin est son
  // pli, qui n'existe que sur elle — « Supprimer » ne dirait plus rien, la card
  // repliée ne le portant de toute façon pas.
  await expect(page.getByRole('button', { name: EXPAND })).toBeHidden();

  // Puis le silence la reprend.
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeHidden({ timeout: 5_000 });
});

/**
 * La card info est collée au bas de la fenêtre : c'est l'endroit du produit où un
 * panneau flottant qui ne sait s'ouvrir que vers le bas se retrouve hors écran.
 * Il l'était — ranger une photo depuis la visionneuse était impossible, sans
 * qu'un pixel ne le dise. L'invariant n'est pas « il s'ouvre vers le haut » mais
 * **« il tient dans l'écran »**, et ça ne se mesure qu'avec un vrai layout.
 *
 * Depuis que la card se replie, ce test garde une seconde chose du même défaut :
 * la card dépliée ne doit pas devenir un conteneur de défilement, sinon elle
 * rognerait ce panneau `absolute` au lieu de le laisser sortir.
 */
test('le sélecteur de zones s’ouvre dans l’écran, jamais sous le bord', async ({ page }) => {
  await openFirstPhoto(page);

  await page.getByRole('button', { name: EXPAND }).click();
  await page.locator('[id^="photo-zones-"]').click();

  const panel = page.getByRole('dialog', { name: 'Sélection de zones' });
  await expect(panel).toBeVisible();

  const box = (await panel.boundingBox())!;
  const viewport = page.viewportSize()!;

  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

/**
 * Le geste natif : on tire la photo suivante, et la piste se repose sur une photo
 * entière. Rien de tout ça n'existe hors d'un moteur de rendu — jsdom n'a ni mise
 * en page, ni défilement, ni points d'ancrage. Les tests vitest ne tiennent donc
 * que la **décision** (sur quelle photo on s'est posé) ; que le geste aboutisse et
 * qu'il ne laisse jamais deux demi-photos à l'écran se prouve ici.
 */
test('le défilement horizontal change de photo, et se repose sur une photo entière', async ({ page }) => {
  await openFirstPhoto(page, 2);

  const track = page.getByTestId('photo-track');
  const width = (await track.boundingBox())!.width;
  await expect(page.getByText('1 sur 2')).toBeVisible();

  await track.hover();
  await page.mouse.wheel(width, 0);

  await expect(page.getByText('2 sur 2')).toBeVisible();

  // L'ancrage : jamais un entre-deux, quelle que soit la force du geste.
  const scrollLeft = await track.evaluate((el) => el.scrollLeft);
  expect(scrollLeft % width).toBeLessThan(1);
});

/**
 * Le pendant du test précédent, dans l'autre sens : les flèches et le clavier
 * conduisent la même piste. Une navigation qui sauterait la piste au lieu de la
 * faire défiler laisserait le compteur et l'image se contredire.
 */
test('la flèche suivante fait défiler la piste, elle ne la court-circuite pas', async ({ page }) => {
  await openFirstPhoto(page, 2);

  const track = page.getByTestId('photo-track');
  const width = (await track.boundingBox())!.width;

  await page.getByRole('button', { name: 'Photo suivante' }).click();

  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(width - 1);
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
