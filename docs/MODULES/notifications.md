# Module — notifications

> Audit : 2026-04-28. Rôle : notifications in-app user-scoped (génériques via type + payload JSON).

## État synthétique

- **Backend** : Présent
- **Frontend** : Absent (pas de `ui/src/features/notifications/`, seul `ui/src/lib/notifications.ts` existe pour le bell HTMX legacy)
- **Locales (en/fr/de/es)** : namespace manquant : `notifications` absent dans les 4 locales
- **Tests** : oui — 2 fichiers (`test_notifications.py`, `test_notifications_extra.py`)
- **Migrations** : 2 (`0001_initial.py`, `0002_notification_soft_delete.py`)

## Modèles & API

- Modèles principaux : `Notification` (user-scoped, pas household-scoped) avec enum `Type` (`HOUSEHOLD_INVITATION`, `HOUSEHOLD_MEMBER_JOINED`, `STOCK_LOW`, `STOCK_OUT`), payload JSON, soft-delete — *source : `apps/notifications/models.py`*
- Endpoints exposés : `/api/notifications/` (ReadOnly liste + détail)
  - `GET /api/notifications/unread-count/`
  - `POST /api/notifications/{id}/mark-read/`
  - `POST /api/notifications/mark-all-read/`
- Permissions : `IsAuthenticated` (filtrage par `user=request.user` + `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:11-16`*
- Service : `apps/notifications/service.py` expose `send(user, type, title, body, payload)` comme point d'entrée unique pour créer une notification

## Notes

- **User-scoped, pas household-scoped** — chaque notification appartient à un utilisateur (FK `user`), pas à un foyer — *source : `apps/notifications/models.py:23-28`*
- Modèle générique : `type` + `payload` JSON permet d'ajouter de nouveaux types sans migration — *source : `apps/notifications/models.py` docstring*
- Soft-delete via `deleted_at` (le viewset filtre `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:16`*
- Service `send()` est le **point d'entrée unique** : tous les callers (households, projects, tasks…) doivent passer par lui — *source : `apps/notifications/service.py:14`*
- **Une notification qui part à plusieurs se rend une fois par destinataire.** Le
  texte est stocké en clair (règle write-time du `CLAUDE.md`), donc il n'y a pas
  de seconde chance à l'affichage : un `gettext` unique autour de la boucle
  envoie à tout le foyer la langue de celui qui a déclenché l'événement. Le
  modèle à suivre est `households/notifications.py::notify_member_joined`, qui
  ouvre un `translation.override(member.user.locale)` **dans** la boucle.
  `stock/notifications.py` ne le fait pas encore.
