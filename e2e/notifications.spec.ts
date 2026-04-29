import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import { test, expect } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = path.resolve(__dirname, '../venv/bin/python');
const MANAGE = path.resolve(__dirname, '../manage.py');
const ROOT = path.resolve(__dirname, '..');
const E2E_ENV = { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings.e2e' };

function runDjangoShell(code: string): string {
  return execSync(`${PYTHON} ${MANAGE} shell`, {
    cwd: ROOT,
    env: E2E_ENV,
    encoding: 'utf-8',
    input: code,
  });
}

const SEED_CODE = `
from django.contrib.auth import get_user_model
from households.models import Household, HouseholdInvitation, HouseholdMember
from notifications.models import Notification
from notifications.service import create_notification
User = get_user_model()
claire = User.objects.get(email='claire.mercier@demo.local')
antoine = User.objects.get(email='antoine.mercier@demo.local')
HouseholdInvitation.objects.filter(invited_user=claire).delete()
Notification.objects.filter(user=claire).delete()
hh = Household.objects.exclude(householdmember__user=claire).first()
if hh is None:
    hh = Household.objects.create(name='Foyer test E2E')
    HouseholdMember.objects.create(household=hh, user=antoine, role='owner')
inv = HouseholdInvitation.objects.create(
    household=hh, invited_user=claire, invited_by=antoine, role='member', status='pending',
)
create_notification(
    user=claire,
    notification_type='household_invitation',
    title='Invitation: ' + hh.name,
    body='Antoine vous invite.',
    payload={'household_id': str(hh.id), 'household_name': hh.name, 'invitation_id': str(inv.id)},
)
print('OUT::' + str(inv.id) + '::' + hh.name)
`;

const CLEAR_CODE = `
from django.contrib.auth import get_user_model
from households.models import HouseholdInvitation
from notifications.models import Notification
User = get_user_model()
claire = User.objects.get(email='claire.mercier@demo.local')
HouseholdInvitation.objects.filter(invited_user=claire).delete()
Notification.objects.filter(user=claire).delete()
`;

function seedInvitationForClaire(): { invitationId: string; householdName: string } {
  const out = runDjangoShell(SEED_CODE);
  const match = out.match(/OUT::([^:]+)::(.+)/);
  if (!match) throw new Error(`Could not parse seed output: ${out}`);
  return { invitationId: match[1], householdName: match[2].trim() };
}

function clearClaireNotifications(): void {
  runDjangoShell(CLEAR_CODE);
}

test.describe('Centre de notifications', () => {
  test.afterEach(() => {
    clearClaireNotifications();
  });

  test('affiche la page sans notifications (empty state)', async ({ page }) => {
    clearClaireNotifications();
    await page.goto('/app/notifications');

    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText('Aucune notification')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tout marquer comme lu/ })).toBeDisabled();
  });

  test('affiche le badge non-lues sur la cloche', async ({ page }) => {
    seedInvitationForClaire();
    await page.goto('/app/dashboard');

    const bell = page.getByTestId('notifications-bell');
    await expect(bell).toBeVisible();
    await expect(page.getByTestId('notifications-bell-badge')).toHaveText('1');
  });

  test('ouvre le dropdown depuis la cloche et navigue vers /app/notifications', async ({ page }) => {
    const { householdName } = seedInvitationForClaire();
    await page.goto('/app/dashboard');

    await page.getByTestId('notifications-bell').click();
    await expect(page.getByText(`Invitation: ${householdName}`)).toBeVisible();

    await page.getByRole('link', { name: 'Voir toutes les notifications' }).click();
    await expect(page).toHaveURL(/\/app\/notifications/);
  });

  test('marque toutes les notifications comme lues', async ({ page }) => {
    seedInvitationForClaire();
    await page.goto('/app/notifications');

    await expect(page.getByTestId('notifications-bell-badge')).toHaveText('1');

    await page.getByRole('button', { name: /Tout marquer comme lu/ }).first().click();

    await expect(page.getByTestId('notifications-bell-badge')).toHaveCount(0);
    await expect(page.getByText('Non lues').locator('xpath=..').getByText('(0)')).toBeVisible();
  });

  test('refuse une invitation depuis la card', async ({ page }) => {
    const { householdName } = seedInvitationForClaire();
    await page.goto('/app/notifications');

    await expect(page.getByText(`Invitation: ${householdName}`)).toBeVisible();
    await page.getByRole('button', { name: 'Refuser', exact: true }).click();

    // La notification est marquée comme lue → badge disparaît
    await expect(page.getByTestId('notifications-bell-badge')).toHaveCount(0);
  });

  test('filtre les notifications non lues', async ({ page }) => {
    seedInvitationForClaire();
    await page.goto('/app/notifications');

    await expect(page.getByRole('button', { name: /Toutes/ })).toBeVisible();
    await page.getByRole('button', { name: /^Non lues/ }).click();
    // La notif non-lue reste visible
    await expect(page.getByText(/Invitation:/)).toBeVisible();

    // Marquer comme lue puis revenir au filtre Non lues → liste vide
    await page.getByRole('button', { name: /^Toutes/ }).click();
    await page.getByRole('button', { name: /Tout marquer comme lu/ }).first().click();
    await page.getByRole('button', { name: /^Non lues/ }).click();
    await expect(page.getByText('Aucune notification non lue')).toBeVisible();
  });
});
