# Module — tasks

> Audit : 2026-04-28. Rôle : tâches household standalone (assignation, due date, complétion) — parcours 03.

## État synthétique

- **Backend** : Présent (`Task` + `TaskZone` + `TaskDocument` + `TaskInteraction`) — modèle dédié décorrélé d'`Interaction` depuis migration `0002_migrate_todos`
- **Frontend** : Complet dans `ui/src/features/tasks/` (`TasksPage`, `TasksPanel`, `TaskCard`, `TaskSection`, `NewTaskDialog`, `TaskDetailDialog`, `TaskAttachmentsDialog`, `TaskAssigneeBadge`, `TaskStatusBadge`, `TaskItemPicker`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `tasks` présent dans les 4 fichiers de traduction
- **Tests** : oui — 2 fichiers backend (`test_api_tasks.py`, `test_task_documents.py`) + e2e `e2e/tasks.spec.ts` + `e2e/project-tasks.spec.ts` ; un dossier `__tests__` existe côté UI mais est vide
- **Migrations** : 4
- **Couverture parcours métier** : parcours 03 (tâches), parcours 06 (assignation/notifications, partiel)

## Modèles & API

- Modèles principaux : `Task` (status, priority, `due_date`, `assigned_to`, `completed_by`, `completed_at`, `is_private`, `source_interaction`), `TaskZone`, `TaskDocument`, `TaskInteraction`
- Endpoints exposés sous `/api/tasks/` : `tasks/` (CRUD + filtres `overdue`, `zone`, `status`, `priority`, `assigned_to`, `project`, `is_private`), `task-documents/`, `task-interactions/` — pagination `LimitOffsetPagination` (default 200, max 500)
- Permissions : `IsHouseholdMember` + permissions custom (`_check_update_permission` views.py:97) — créateur peut tout modifier ; assigné ne peut modifier que `status` ; seul le créateur peut supprimer ou gérer les attachments. `perform_destroy` fait un soft-delete vers `status='archived'`

## Notes / décisions produit

- Décision V1 (parcours 03) : « les tâches restent des `Interaction` avec `type='todo'` » a été depuis dépassée — un modèle `Task` autonome existe (migration `0002_migrate_todos`). `source_interaction` (FK nullable) permet de garder la trace de l'origine pour les tâches migrées ou créées depuis un événement.
- Contraintes notables : `tasks_completed_integrity` (si `completed_at` set, `completed_by` doit l'être aussi) et `tasks_private_not_assigned` (une tâche privée ne peut pas être assignée).
- P2 (commit b4ebcc8) a livré : toast undo visible (fix timer Radix), réservation de hauteur pour éviter le flash empty-state, skeleton avec `bg-muted`, `color-scheme: dark` sur les inputs date/time en dark mode.
- La transition `done` est correctement gérée côté backend (`apps/tasks/views.py:123-128`) : `completed_at` et `completed_by` sont auto-set / auto-cleared.
- La page `TasksPage` est un wrapper minimal de `TasksPanel` (réutilisable côté projets).
- Suppression : soft-delete via `status='archived'` côté backend ; le frontend utilise `useDeleteWithUndo` + DELETE HTTP, donc l'undo restaure en repassant l'item en `pending` (à vérifier dans le hook `useDeleteTask`).
