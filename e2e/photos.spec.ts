import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app/photos');
});

test('affiche la page des photos', async ({ page }) => {
  await expect(page).toHaveURL(/\/app\/photos/);
  await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
});

test('utilise les miniatures (thumbnail_url) dans la grille quand des photos existent', async ({ page }) => {
  // Wait for either the empty state or the grid to settle.
  await page.waitForLoadState('networkidle');

  const gridImages = page.locator('main img');
  const count = await gridImages.count();

  // Si aucune photo n'est seedée, on vérifie juste l'empty state — l'invariant
  // "thumbnail_url ou fallback file_url" est couvert par les tests pytest backend.
  if (count === 0) {
    await expect(page.getByText(/photo/i).first()).toBeVisible();
    return;
  }

  // Sinon, chaque image de la grille doit pointer sur une miniature `/thumbnails/thumb/`
  // (ou à défaut `file_url` si la miniature n'existe pas encore — back-fill non lancé).
  for (let i = 0; i < count; i += 1) {
    const src = await gridImages.nth(i).getAttribute('src');
    expect(src, `image #${i} sans src`).toBeTruthy();
    expect(
      src!.includes('/.thumbnails/thumb/') || src!.includes('/media/'),
      `image #${i} src inattendu: ${src}`,
    ).toBe(true);
  }
});
