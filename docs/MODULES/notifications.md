# Module — notifications

> Audit : 2026-04-27. Rôle : notifications in-app user-scoped (génériques via type + payload JSON).

## État synthétique

- **Backend** : Présent
- **Frontend** : Absent (pas de `ui/src/features/notifications/`, seul `ui/src/lib/notifications.ts` existe pour le bell HTMX legacy)
- **Locales (en/fr/de/es)** : namespace manquant : `notifications` absent dans les 4 locales
- **Tests** : oui — 2 fichiers (`test_notifications.py`, `test_notifications_extra.py`)
- **Migrations** : 2 (`0001_initial.py`, `0002_notification_soft_delete.py`)

## Modèles & API

- Modèles principaux : `Notification` (user-scoped, pas household-scoped) avec enum `Type` (`HOUSEHOLD_INVITATION` seulement pour l'instant), payload JSON, soft-delete — *source : `apps/notifications/models.py`*
- Endpoints exposés : `/api/notifications/` (ReadOnly liste + détail)
  - `GET /api/notifications/unread-count/`
  - `POST /api/notifications/{id}/mark-read/`
  - `POST /api/notifications/mark-all-read/`
- Permissions : `IsAuthenticated` (filtrage par `user=request.user` + `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:11-16`*
- Service : `apps/notifications/service.py` expose `send(user, type, title, body, payload)` comme point d'entrée unique pour créer une notification

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.
- _aucun item identifié_

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] **Construire la UI notifications** : panneau bell (dropdown ou drawer) consommant `/api/notifications/` + `unread-count` + `mark-read` / `mark-all-read` — *source : absence de `ui/src/features/notifications/`, seul `ui/src/lib/notifications.ts` legacy HTMX existe*
- [ ] Créer `ui/src/lib/api/notifications.ts` avec types alignés sur `NotificationSerializer` — *source : absence du fichier*
- [ ] Ajouter le namespace `notifications` dans les 4 locales (titres, libellés, états vide) — *source : grep des locales*
- [ ] Étendre les types : ajouter notifications pour assignation de tâche (lié à Parcours 06 V2) — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-10 · `TO_FIX.md` ligne 21*
- [ ] Notifications pour alertes proactives (tâches en retard, garanties expirantes, maintenances dues) — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-02/FEAT-05*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Préparer la migration polling → WebSocket : le commentaire `# Future: channel_layer.group_send(...)` indique l'intention mais nécessitera du travail (channels, ASGI) — *source : `apps/notifications/service.py:32`*
- [ ] L'event `BELL_REFRESH_EVENT` est dupliqué entre `apps/notifications/service.py:11` et `ui/src/lib/notifications.ts:8` — relique du legacy HTMX, à nettoyer une fois la UI React en place

## Notes

- **User-scoped, pas household-scoped** — chaque notification appartient à un utilisateur (FK `user`), pas à un foyer — *source : `apps/notifications/models.py:23-28`*
- Modèle générique : `type` + `payload` JSON permet d'ajouter de nouveaux types sans migration — *source : `apps/notifications/models.py` docstring*
- Soft-delete via `deleted_at` (le viewset filtre `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:16`*
- Service `send()` est le **point d'entrée unique** : tous les callers (households, projects, tasks…) doivent passer par lui — *source : `apps/notifications/service.py:14`*
