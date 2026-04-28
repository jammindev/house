import { test, expect } from './fixtures';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = path.resolve(__dirname, '../venv/bin/python');
const ROOT = path.resolve(__dirname, '..');
const E2E_ENV = { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings.e2e' };

test.use({ storageState: { cookies: [], origins: [] } });

function generateResetTokenForEmail(email: string): { uid: string; token: string } {
  const script = `
import json, django
django.setup()
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from accounts.models import User
u = User.objects.get(email="${email}")
print(json.dumps({
  "uid": urlsafe_base64_encode(force_bytes(u.pk)),
  "token": default_token_generator.make_token(u),
}))
`;
  const out = execSync(`${PYTHON} -c '${script}'`, { env: E2E_ENV, cwd: ROOT }).toString().trim();
  return JSON.parse(out);
}

function setUserPassword(email: string, password: string): void {
  const script = `
import django
django.setup()
from accounts.models import User
u = User.objects.get(email="${email}")
u.set_password("${password}")
u.save(update_fields=["password"])
`;
  execSync(`${PYTHON} -c '${script}'`, { env: E2E_ENV, cwd: ROOT });
}

test('forgot password — accès depuis le login + envoi affiche le message générique', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await expect(page.getByRole('heading', { name: 'Réinitialiser le mot de passe' })).toBeVisible();

  await page.getByPlaceholder('Email').fill('claire.mercier@demo.local');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();

  await expect(
    page.getByText(/Si un compte existe pour cet email/)
  ).toBeVisible({ timeout: 10000 });
});

test('forgot password — email inconnu affiche aussi le message générique', async ({ page }) => {
  await page.goto('/forgot-password');

  await page.getByPlaceholder('Email').fill('unknown@example.com');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();

  await expect(
    page.getByText(/Si un compte existe pour cet email/)
  ).toBeVisible({ timeout: 5000 });
});

test('reset password — sans uid/token affiche un message d\'erreur', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByText(/lien est invalide ou a expiré/)).toBeVisible();
});

test('reset password — flow complet : token valide → login avec le nouveau mdp', async ({ page }) => {
  const email = 'claire.mercier@demo.local';
  const newPassword = 'BrandNewPass!2026';

  const { uid, token } = generateResetTokenForEmail(email);

  try {
    await page.goto(`/reset-password?uid=${uid}&token=${token}`);
    await page.getByPlaceholder('Nouveau mot de passe').fill(newPassword);
    await page.getByPlaceholder('Confirmer le mot de passe').fill(newPassword);
    await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Mot de passe réinitialisé/)).toBeVisible();

    // Re-login avec le nouveau mot de passe pour confirmer le changement
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Mot de passe').fill(newPassword);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  } finally {
    // Restaurer le mdp seed pour ne pas casser les specs suivantes
    setUserPassword(email, 'demo1234');
  }
});

test('reset password — token invalide affiche une erreur', async ({ page }) => {
  const { uid } = generateResetTokenForEmail('claire.mercier@demo.local');

  await page.goto(`/reset-password?uid=${uid}&token=invalid-token-xxx`);
  await page.getByPlaceholder('Nouveau mot de passe').fill('BrandNewPass!2026');
  await page.getByPlaceholder('Confirmer le mot de passe').fill('BrandNewPass!2026');
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();

  await expect(page.getByText(/invalide ou a expiré|Invalid/i)).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/\/reset-password/);
});

test('reset password — mots de passe non identiques affiche une erreur', async ({ page }) => {
  await page.goto('/reset-password?uid=fake&token=fake');
  await page.getByPlaceholder('Nouveau mot de passe').fill('BrandNewPass!2026');
  await page.getByPlaceholder('Confirmer le mot de passe').fill('Different!2026');
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();

  await expect(page.getByText(/ne correspondent pas/)).toBeVisible();
});
