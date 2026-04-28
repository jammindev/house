# Module — app_settings

> Audit : 2026-04-27. Rôle : namespace UI pour les paramètres utilisateur (profil, thème, mot de passe, gestion du foyer).

## État synthétique

- **Backend** : Absent (pas de modèle propre — l'app Django ne contient que `apps.py`, `templates/` legacy et un test `test_switch_household.py`)
- **Frontend** : Complet dans `ui/src/features/settings/` (`SettingsPage`, components `ProfileSection`, `ThemeSection`, `ChangePasswordSection`, `AvatarSection`, `HouseholdManagement`, `PendingInvitations`)
- **Locales (en/fr/de/es)** : ok (namespace `settings` présent dans les 4 locales)
- **Tests** : oui — 1 fichier (`test_switch_household.py`)
- **Migrations** : 0

## Modèles & API

- Modèles principaux : aucun — toutes les données sont stockées dans `accounts` (User, profil) et `households` (membership, invitations)
- Endpoints exposés : aucun propre — la page consomme `/api/accounts/` (user + change password + avatar) et `/api/households/switch/` — *source : `ui/src/features/settings/SettingsPage.tsx:33`*
- Permissions : héritées des apps consommées

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- [ ] Perte du thème (light/dark) au logout — au reconnexion le thème revient au défaut — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-01 · `A_AMELIORER_STYLE.md`*
- [ ] Blink de thème au chargement du dashboard (flash of unstyled content avant résolution du thème) — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-02*

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] Quand on crée un foyer, devenir automatiquement owner — *source : `URGENT.md` ligne 1*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Supprimer les composants legacy dupliqués dans `apps/app_settings/react/components/` (AvatarSection, ChangePasswordSection, HouseholdManagement, PendingInvitations, ProfileSection, SettingsSection, ThemeSection) — versions modernes maintenues dans `ui/src/features/settings/components/` — *source : comparaison des deux dossiers*
- [ ] Templates legacy dans `apps/app_settings/templates/app_settings/app/` à archiver/supprimer une fois la SPA stabilisée

## Notes

- **Pas de modèle propre** : `app_settings` est purement un namespace UI agrégeant des sections de plusieurs apps backend (`accounts`, `households`) — *source : absence de `models.py` dans `apps/app_settings/`*
- Le dossier React canonique est `ui/src/features/settings/` (pas `app_settings/`) — le nom diffère entre Django et la SPA
- Composants legacy dans `apps/app_settings/react/` peuvent rester (relique pré-migration SPA) — décision projet documentée dans le brief
- Le test `test_switch_household.py` couvre l'endpoint `/api/households/switch/` consommé par `HouseholdManagement` — *source : `apps/app_settings/tests/test_switch_household.py`*
