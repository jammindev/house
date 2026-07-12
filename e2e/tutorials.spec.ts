import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Page Tutoriel — /app/tutorial
// Checklist « Bien démarrer », guides par module, progression persistée
// sur User.completed_tutorials (PATCH /api/accounts/users/me/).
// ---------------------------------------------------------------------------

/**
 * Remet la progression tutoriel à zéro via l'API pour repartir d'un état connu.
 */
async function resetTutorialProgress(page: import('@playwright/test').Page): Promise<void> {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  await page.request.patch('/api/accounts/users/me/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { completed_tutorials: [] },
  });
}

test.describe('Page Tutoriel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await resetTutorialProgress(page);
    await page.goto('/app/tutorial');
    await expect(page.getByRole('heading', { name: 'Tutoriel' })).toBeVisible();
  });

  test('accessible depuis la sidebar', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.getByRole('link', { name: 'Tutoriel' }).click();
    await expect(page).toHaveURL(/\/app\/tutorial$/);
    await expect(page.getByRole('heading', { name: 'Tutoriel' })).toBeVisible();
  });

  test('affiche la progression, la checklist et les guides', async ({ page }) => {
    await expect(page.getByText('Votre progression')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bien démarrer' })).toBeVisible();
    await expect(page.getByText('Décrire votre logement en zones')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guides par module' })).toBeVisible();
    await expect(page.getByText('Gérer les tâches')).toBeVisible();
  });

  test('cocher un item de la checklist met à jour la progression', async ({ page }) => {
    await expect(page.getByText('0 sur', { exact: false })).toBeVisible();
    // premier item : « Décrire votre logement en zones »
    const patched = page.waitForResponse(
      (r) => r.url().includes('/api/accounts/users/me/') && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Marquer comme terminé' }).first().click();
    await expect(page.getByText('1 sur', { exact: false })).toBeVisible();
    await patched;
    // l'état survit à un rechargement (persisté côté serveur)
    await page.reload();
    await expect(page.getByText('1 sur', { exact: false })).toBeVisible();
  });

  test('un guide s\'ouvre, se termine et se rouvre', async ({ page }) => {
    await page.getByText('Gérer les tâches').click();
    await expect(page).toHaveURL(/\/app\/tutorial\/tasks$/);
    // les étapes numérotées sont visibles
    await expect(page.getByText('Créer une tâche')).toBeVisible();
    await expect(page.getByText('Filtrer et organiser')).toBeVisible();

    // marquer terminé → le bouton bascule
    await page.getByRole('button', { name: 'Marquer comme terminé' }).click();
    await expect(page.getByRole('button', { name: 'Marquer à revoir' })).toBeVisible();

    // retour à la liste : le guide est badgé terminé
    await page.getByRole('link', { name: 'Retour' }).click();
    await expect(page).toHaveURL(/\/app\/tutorial$/);

    // re-basculer pour laisser un état propre
    await page.getByText('Gérer les tâches').click();
    await page.getByRole('button', { name: 'Marquer à revoir' }).click();
    await expect(page.getByRole('button', { name: 'Marquer comme terminé' })).toBeVisible();
  });

  test('le lien « Ouvrir la page » mène au module', async ({ page }) => {
    await page.getByText('Gérer les tâches').click();
    await page.getByRole('link', { name: 'Ouvrir la page', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tasks/);
  });

  test('guide inconnu → état vide', async ({ page }) => {
    await page.goto('/app/tutorial/nexiste-pas');
    await expect(page.getByText('Ce guide n\'existe pas.')).toBeVisible();
  });
});
