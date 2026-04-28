# Module — notifications

> Audit : 2026-04-28. Rôle : notifications in-app user-scoped (génériques via type + payload JSON).

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
- [ ] **Centre de notifications frontend entièrement absent** : un utilisateur invité à un foyer ne voit aucune indication UI ; l'invitation reste invisible — *source : #63 (blocker)*

## À faire (backlog)

> Features identifiées non encore commencées.
- [ ] Construire la UI notifications : badge compteur dans la navbar, dropdown ou page `/notifications`, actions mark-read / mark-all-read, action accept/refuse invitation depuis la notif — *source : #63*
- [ ] Créer `ui/src/lib/api/notifications.ts` avec types alignés sur `NotificationSerializer` — *source : absence du fichier, vérifiée `ui/src/lib/api/`*
- [ ] Ajouter le namespace `notifications` dans les 4 locales (titres, libellés, état vide) — *source : grep des locales (namespace absent)*
- [ ] Étendre les types : notifications pour assignation de tâche (lié à Parcours 06 V2) — *source : #40*

## À améliorer

> Refacto, perf, UX, qualité de code.
- [ ] Préparer la migration polling → WebSocket : le commentaire `# Future: channel_layer.group_send(...)` indique l'intention mais nécessitera du travail (channels, ASGI) — *source : `apps/notifications/service.py:32`*
- [ ] L'event `BELL_REFRESH_EVENT` est dupliqué entre `apps/notifications/service.py:11` et `ui/src/lib/notifications.ts:8` — relique du legacy HTMX, à nettoyer une fois la UI React en place
- [ ] Vérifier et activer l'envoi d'email pour les invitations foyer — *source : #64*

## Notes

- **User-scoped, pas household-scoped** — chaque notification appartient à un utilisateur (FK `user`), pas à un foyer — *source : `apps/notifications/models.py:23-28`*
- Modèle générique : `type` + `payload` JSON permet d'ajouter de nouveaux types sans migration — *source : `apps/notifications/models.py` docstring*
- Soft-delete via `deleted_at` (le viewset filtre `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:16`*
- Service `send()` est le **point d'entrée unique** : tous les callers (households, projects, tasks…) doivent passer par lui — *source : `apps/notifications/service.py:14`*
