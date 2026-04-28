# Module — households

> Audit : 2026-04-28. Rôle : multi-tenancy — foyer, membres, rôles, invitations et household actif.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet — gestion intégrée dans `ui/src/features/settings/components/HouseholdManagement/` et `PendingInvitations.tsx` ; pas de page dédiée (settings)
- **Locales (en/fr/de/es)** : ok — clés sous le namespace `settings` présent dans les 4 locales (pas de namespace `households` dédié)
- **Tests** : oui — 2 fichiers (`tests.py` 449 lignes, `test_invitations.py` 262 lignes)
- **Migrations** : 7

## Modèles & API

- Modèles principaux : `Household` (UUID PK, soft-delete via `archived_at`, `inbound_email_alias`, `country`, `timezone`), `HouseholdMember` (composite unique sur `household + user`, `role` owner/member), `HouseholdInvitation` (status pending/accepted/declined) — `apps/households/models.py`
- Endpoints exposés sous `/api/households/` :
  - `GET|POST /` (list = mes households non archivés), `GET|PATCH|DELETE /{id}/` (DELETE = soft archive)
  - `GET /{id}/members/`, `GET /active-members/`, `POST /{id}/leave/`
  - `POST /switch/` (change l'`active_household` du user)
  - `POST /{id}/invite/`, `POST /{id}/remove_member/`, `POST /{id}/update_role/`
  - `GET /invitations/` (les miennes en attente), `POST /invitations/{id}/accept/`, `POST /invitations/{id}/decline/`
- Permissions : `IsAuthenticated` partout ; `IsHouseholdOwner` pour `update`, `partial_update`, `destroy`, `invite`, `remove_member`, `update_role` ; `IsHouseholdMember` pour `retrieve`, `members`, `leave` (`apps/households/views.py:30-36`)

## Notes

- Soft-delete via `archived_at` (`destroy` met simplement le timestamp). Filtrage `archived_at__isnull=True` dans `get_queryset` (`apps/households/views.py:41`).
- Signaux `post_save` / `post_delete` sur `HouseholdMember` gèrent automatiquement `User.active_household` à l'arrivée et au départ d'un membre — `apps/households/signals.py`.
- Signal `post_save` sur `Household` crée automatiquement une zone racine "Maison" (`parent=None`) à la création de chaque foyer — `apps/households/signals.py:7-13`.
- Le routing utilise un `SimpleRouter` séparé pour `/invitations/` afin d'éviter un shadow du détail household — `apps/households/urls.py:9-17`.
- Le dernier owner ne peut ni quitter, ni être dému/retiré (vérifications dans `leave`, `remove_member`, `update_role`).
- Une invitation génère automatiquement une notification in-app via `notifications.service.create_notification` (`apps/households/views.py:201-218`).
