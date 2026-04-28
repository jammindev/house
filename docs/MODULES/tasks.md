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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

_aucun item identifié_ — les 5 bugs P2 ont été livrés dans le commit b4ebcc8 (toast undo visible, statut `pending` par défaut, flash empty-state, dark mode calendrier, transition `done` validée).

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Assignation de tâche + notifications (Parcours 06 V2) — *#40*
- [ ] Récurrence des tâches — *#75*
- [ ] Créer une tâche depuis une interaction — *#76*
- [ ] Revoir le mécanisme « en cours → done » (aujourd'hui un même bouton inline) — *source : inspection `apps/tasks/views.py`*
- [ ] Mieux gérer les priorités : tri du plus haut au bas, suggestion IA — *source : inspection code*
- [ ] Vérifier le lien tâche ↔ interaction (couverture côté UI/API) — *source : inspection `apps/tasks/models.py`*
- [ ] Revoir le comportement avec le backlog : sélecteur multi-statuts ou switch « à faire / backlog » à la création — *source : inspection code*
- [ ] Tâches privées : exposer dans l'UI le filtre « mes tâches privées » via `is_private` + `created_by` — *source : inspection `apps/tasks/views.py`*
- [ ] Statut `in_progress` : décider s'il est permanent ou supprimé — *source : inspection `apps/tasks/models.py`*
- [ ] Permissions fines pour qui peut assigner les tâches — *source : inspection `apps/tasks/views.py`*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Faire re-checker le modèle `Task` par l'IA (audit des contraintes / index) — *source : inspection `apps/tasks/models.py`*
- [ ] Dossier `ui/src/features/tasks/__tests__/` vide — aucun test unit React ; couverture frontend repose uniquement sur e2e — *source : inspection `ui/src/features/tasks/`*
- [ ] Documenter les patterns `useDeleteWithUndo` + `useSessionState` utilisés ici — *#53*
- [ ] Pagination default 200 / max 500 (élevé) — le frontend gère le filtrage côté client ; envisager une pagination plus fine si le volume croît — *source : `apps/tasks/views.py`*

## Notes / décisions produit

- Décision V1 (parcours 03) : « les tâches restent des `Interaction` avec `type='todo'` » a été depuis dépassée — un modèle `Task` autonome existe (migration `0002_migrate_todos`). `source_interaction` (FK nullable) permet de garder la trace de l'origine pour les tâches migrées ou créées depuis un événement.
- Contraintes notables : `tasks_completed_integrity` (si `completed_at` set, `completed_by` doit l'être aussi) et `tasks_private_not_assigned` (une tâche privée ne peut pas être assignée).
- P2 (commit b4ebcc8) a livré : toast undo visible (fix timer Radix), réservation de hauteur pour éviter le flash empty-state, skeleton avec `bg-muted`, `color-scheme: dark` sur les inputs date/time en dark mode.
- La transition `done` est correctement gérée côté backend (`apps/tasks/views.py:123-128`) : `completed_at` et `completed_by` sont auto-set / auto-cleared.
- La page `TasksPage` est un wrapper minimal de `TasksPanel` (réutilisable côté projets).
- Suppression : soft-delete via `status='archived'` côté backend ; le frontend utilise `useDeleteWithUndo` + DELETE HTTP, donc l'undo restaure en repassant l'item en `pending` (à vérifier dans le hook `useDeleteTask`).
- Référence : `docs/TASK_V2.md` pour les décisions d'architecture du modèle autonome.
