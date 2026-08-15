import { test, expect, type Page } from '@playwright/test';

/**
 * Étiquettes QR de zone — l'ancrage physique du parcours 31 (lot 1, issue #608).
 *
 * Ce que seul un vrai navigateur atteste ici : l'URL imprimée sur une étiquette
 * ouvre bien la pièce **depuis une navigation directe**, comme le fait l'appareil
 * photo natif d'un téléphone — pas depuis un clic dans l'app, où le contexte est
 * déjà chargé. C'est exactement la situation que le lot doit tenir, et aucun test
 * unitaire ne la reproduit.
 *
 * Couvre `CHAS-01`, `CHAS-02` et `CHAS-03` de `docs/USER_STORIES.md`.
 */

async function getAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

interface Label {
  zone_id: string;
  name: string;
  path: string;
  url: string;
  svg: string;
}

/** La planche d'étiquettes du foyer, lue par l'API avec le JWT du navigateur. */
async function fetchLabels(page: Page): Promise<Label[]> {
  const token = await getAccessToken(page);
  const response = await page.request.get('/api/zones/print-sheet/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { count: number; labels: Label[] };
  return body.labels;
}

test.describe('Étiquettes QR de zone', () => {
  test('CHAS-01 — la planche affiche une étiquette scannable par pièce', async ({ page }) => {
    await page.goto('/app/zones');
    await page.getByRole('button', { name: 'Étiquettes QR' }).click();

    await expect(page).toHaveURL(/\/app\/zones\/print-qr/);
    await expect(page.getByRole('heading', { name: 'Étiquettes QR des pièces' })).toBeVisible();

    // Une étiquette = un QR rendu (SVG servi par le backend) + le nom de la pièce.
    const codes = page.locator('svg.segno');
    await expect(codes.first()).toBeVisible();

    const labels = await fetchLabels(page);
    expect(labels.length).toBeGreaterThan(0);
    await expect(codes).toHaveCount(labels.length);

    for (const label of labels) {
      expect(label.path).toMatch(/^\/z\/.+/);
      expect(label.svg).toContain('<svg');
      // Le jeton n'est pas l'identifiant de la zone — c'est tout l'intérêt.
      expect(label.path).not.toContain(label.zone_id);
    }
  });

  test('CHAS-02 — scanner une étiquette ouvre la pièce qu\'elle désigne', async ({ page }) => {
    await page.goto('/app/zones');
    const labels = await fetchLabels(page);
    const label = labels.find((candidate) => candidate.name !== '') as Label;

    // Navigation directe : c'est ce que fait l'appareil photo du téléphone.
    await page.goto(label.path);

    await expect(page).toHaveURL(new RegExp(`/app/zones/${label.zone_id}`));
    await expect(page.getByRole('heading', { name: label.name })).toBeVisible();
  });

  test('CHAS-02 — une étiquette inconnue le dit, sans mener nulle part', async ({ page }) => {
    await page.goto('/app/zones');
    await page.goto('/z/jeton-qui-ne-designe-aucune-piece');

    await expect(page.getByText('Étiquette inconnue')).toBeVisible();
    await expect(page).toHaveURL(/\/z\//);
  });

  test('CHAS-03 — régénérer le jeton rend l\'ancienne étiquette muette', async ({ page }) => {
    await page.goto('/app/zones');
    const labels = await fetchLabels(page);
    const target = labels[0];
    const stalePath = target.path;

    const token = await getAccessToken(page);
    const rotated = await page.request.post(`/api/zones/${target.zone_id}/rotate-qr/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(rotated.ok()).toBeTruthy();
    const fresh = (await rotated.json()) as Label;
    expect(fresh.path).not.toBe(stalePath);

    // L'ancienne étiquette ne désigne plus rien…
    await page.goto(stalePath);
    await expect(page.getByText('Étiquette inconnue')).toBeVisible();

    // …et la nouvelle ouvre toujours la même pièce.
    await page.goto(fresh.path);
    await expect(page).toHaveURL(new RegExp(`/app/zones/${target.zone_id}`));
  });
});
