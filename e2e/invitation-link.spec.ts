import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Le parcours d'invitation de bout en bout.
 *
 * Il ne pouvait pas exister avant : `invite` exigeait un compte House
 * pré-existant et répondait 404, alors qu'aucune inscription n'était offerte
 * nulle part dans l'app. En prod, deux POST sur `/invite/` ont fini en 404 sans
 * qu'aucune invitation n'ait jamais été créée.
 *
 * Ce que seul un vrai navigateur atteste ici : le lien produit par l'owner ouvre
 * bien une page publique, y crée un compte, et connecte la personne dans le
 * foyer sans repasser par l'écran de connexion.
 */

/**
 * Adresse neuve à chaque exécution.
 *
 * `seed_demo_data --flush` ne purge que les données de démo : les comptes créés
 * par un run précédent survivent, et rejoindre refuse — à raison — une adresse
 * déjà prise. Une adresse figée rendait donc le test vert une seule fois.
 */
function freshEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Ouvre le panneau « Inviter » du foyer de démo. */
async function openInvitePanel(page: Page): Promise<Locator> {
  await page.goto('/app/settings');
  const householdItem = page.locator('li').filter({ hasText: 'Famille Mercier' }).first();
  await householdItem.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Inviter' }).click();
  return page.getByRole('dialog');
}

/** La ligne du panneau qui porte cette adresse. */
function invitationRow(dialog: Locator, email: string): Locator {
  return dialog.getByTestId('invitation-row').filter({ hasText: email });
}

/**
 * Crée un lien d'invitation adressé et renvoie son token.
 *
 * Toujours adressé, et jamais repéré par sa position : les liens s'accumulent
 * d'un test à l'autre (rien ne réinitialise la base entre eux) et la liste
 * n'est rafraîchie qu'après la mutation, si bien que « le premier `code` »
 * renvoyait le lien d'un test précédent, déjà consommé.
 */
async function createInvitationLink(page: Page, email: string): Promise<string> {
  const dialog = await openInvitePanel(page);
  await dialog.getByLabel('E-mail (facultatif)').fill(email);
  await dialog.getByRole('button', { name: 'Créer le lien' }).click();

  const row = invitationRow(dialog, email);
  await expect(row).toBeVisible();
  const url = (await row.locator('code').innerText()).trim();
  expect(url).toContain('/join/');

  // `FRONTEND_URL` vise le serveur Vite en dev ; le test navigue sur le serveur
  // E2E, donc on ne garde que le token.
  return url.split('/join/')[1];
}

test('un owner crée un lien d’invitation et le voit affiché', async ({ page }) => {
  const invited = freshEmail('nouveau.venu');
  const token = await createInvitationLink(page, invited);
  expect(token.length).toBeGreaterThan(20);

  // Le lien reste listé, pour être recopié plus tard.
  const dialog = await openInvitePanel(page);
  await expect(invitationRow(dialog, invited).locator('code')).toContainText(token);
});

test('une personne sans compte ouvre le lien et rejoint le foyer', async ({ page, browser }) => {
  const invited = freshEmail('camille');
  const token = await createInvitationLink(page, invited);

  // Contexte vierge : ni session, ni token — comme quelqu'un qui reçoit le lien
  // par message et n'a jamais entendu parler de House.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const guest = await context.newPage();
  await guest.goto(`/join/${token}`);

  // Elle sait ce qu'elle rejoint avant de saisir quoi que ce soit.
  await expect(guest.getByRole('heading', { name: /Famille Mercier/ })).toBeVisible();

  // L'invitation étant adressée, l'adresse est pré-remplie et verrouillée : un
  // lien transmis ne doit pas servir à ouvrir un compte sur une autre adresse.
  await expect(guest.getByLabel('Email')).toHaveValue(invited);
  await expect(guest.getByLabel('Email')).toHaveAttribute('readonly', '');

  await guest.getByLabel('Votre nom').fill('Camille');
  await guest.getByLabel('Choisissez un mot de passe').fill('un-mot-de-passe-solide');
  await guest.getByRole('button', { name: 'Rejoindre le foyer' }).click();

  // Connectée directement : pas de retour à l'écran de connexion pour retaper
  // le mot de passe qu'elle vient de choisir.
  await expect(guest).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });

  await context.close();
});

test('un lien déjà utilisé n’ouvre plus rien', async ({ page, browser }) => {
  const invited = freshEmail('premier');
  const token = await createInvitationLink(page, invited);

  const first = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const firstPage = await first.newPage();
  await firstPage.goto(`/join/${token}`);
  await firstPage.getByLabel('Choisissez un mot de passe').fill('un-mot-de-passe-solide');
  await firstPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
  await expect(firstPage).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
  await first.close();

  const second = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const secondPage = await second.newPage();
  await secondPage.goto(`/join/${token}`);
  await expect(secondPage.getByRole('heading', { name: 'Lien invalide' })).toBeVisible();
  await second.close();
});

test('un lien révoqué n’ouvre plus rien', async ({ page, browser }) => {
  const invited = freshEmail('a.revoquer');
  const token = await createInvitationLink(page, invited);

  const dialog = page.getByRole('dialog');
  await invitationRow(dialog, invited).getByRole('button', { name: 'Révoquer ce lien' }).click();
  await expect(invitationRow(dialog, invited)).toHaveCount(0);

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const guest = await context.newPage();
  await guest.goto(`/join/${token}`);
  await expect(guest.getByRole('heading', { name: 'Lien invalide' })).toBeVisible();
  // Le nom du foyer ne doit pas fuiter vers qui détient encore le lien.
  await expect(guest.getByText('Famille Mercier')).toBeHidden();
  await context.close();
});
