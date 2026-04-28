# Module — households

> Audit : 2026-04-27. Rôle : multi-tenancy — foyer, membres, rôles, invitations et household actif.

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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] Quand on crée un foyer on est automatiquement owner — comportement attendu mais à vérifier dans le flow réel — *source : `URGENT.md` ligne 1* (le code actuel `apps/households/views.py:64-68` enregistre déjà le créateur en owner — vérifier que le frontend en tient compte)
- [ ] À la création d'un household, créer une zone ancêtre unique représentant le foyer (pas de zones frère/soeur racine possibles) — *source : `URGENT.md` ligne 2*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Mécanisme générique d'autoset de la zone ancêtre côté backend si aucune zone fournie sur les objets liés (ou erreur explicite) — *source : `URGENT.md` ligne 2*
- [ ] Créer une `HouseholdDetailView` de base dans `apps/core/views.py` pour encapsuler le scoping et éviter le boilerplate dans les vues — *source : `GITHUB_ISSUES_BACKLOG.md` REFACTOR-02 / `docs/ARCHITECTURE_AUDIT_2026_03.md`*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Uniformiser la structure des tests : `tests.py` + `test_invitations.py` à la racine → `tests/` avec `test_models.py`, `test_views.py`, `test_serializers.py`, `factories.py` — *source : `GITHUB_ISSUES_BACKLOG.md` REFACTOR-04 / `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 79-90*
- [ ] `HouseholdDetailSerializer` est strictement identique à `HouseholdSerializer` (même `Meta.fields`) — supprimer ou enrichir — *source : `apps/households/serializers.py:47-50`*
- [ ] `current_user_role` recalculé via SerializerMethodField à chaque sérialisation : envisager prefetch / annotate sur les listes — *source : `apps/households/serializers.py:37-44`*

## Notes

- Soft-delete via `archived_at` (`destroy` met simplement le timestamp). Filtrage `archived_at__isnull=True` dans `get_queryset` (`apps/households/views.py:41`).
- Signaux `post_save` / `post_delete` sur `HouseholdMember` gèrent automatiquement `User.active_household` à l'arrivée et au départ d'un membre — `apps/households/signals.py`.
- Le routing utilise un `SimpleRouter` séparé pour `/invitations/` afin d'éviter un shadow du détail household — `apps/households/urls.py:9-17`.
- Le dernier owner ne peut ni quitter, ni être dému/retiré (vérifications dans `leave`, `remove_member`, `update_role`).
- Une invitation génère automatiquement une notification utilisateur via `notifications.service.create_notification` (`apps/households/views.py:201-218`).
