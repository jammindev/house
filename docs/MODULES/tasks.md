# Module — tasks

> Audit : 2026-04-27. Rôle : tâches household standalone (assignation, due date, complétion) — parcours 03.

## État synthétique

- **Backend** : Présent (`Task` + `TaskZone` + `TaskDocument` + `TaskInteraction`) — modèle dédié décorrélé d'`Interaction` depuis migration `0002_migrate_todos`
- **Frontend** : Complet dans `ui/src/features/tasks/` (`TasksPage`, `TasksPanel`, `TaskCard`, `TaskSection`, `NewTaskDialog`, `TaskDetailDialog`, `TaskAttachmentsDialog`, `TaskAssigneeBadge`, `TaskStatusBadge`, `TaskItemPicker`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `tasks` présent dans les 4 fichiers (ligne 432)
- **Tests** : oui — 2 fichiers backend (`test_api_tasks.py`, `test_task_documents.py`) + e2e `e2e/tasks.spec.ts` + `e2e/project-tasks.spec.ts` ; un dossier `__tests__` existe côté UI mais est vide
- **Migrations** : 4

## Modèles & API

- Modèles principaux : `Task` (status, priority, `due_date`, `assigned_to`, `completed_by`, `completed_at`, `is_private`, `source_interaction`), `TaskZone`, `TaskDocument`, `TaskInteraction`
- Endpoints exposés sous `/api/tasks/` : `tasks/` (CRUD + filtres `overdue`, `zone`, `status`, `priority`, `assigned_to`, `project`, `is_private`), `task-documents/`, `task-interactions/` — pagination `LimitOffsetPagination` (default 200, max 500)
- Permissions : `IsHouseholdMember` + permissions custom (`_check_update_permission` views.py:97) — créateur peut tout modifier ; assigné ne peut modifier que `status` ; seul le créateur peut supprimer ou gérer les attachments. `perform_destroy` fait un soft-delete vers `status='archived'`

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] Vérifier le bon enregistrement de `completed_by` + `completed_at` à la transition `done` (logique côté `perform_update` à valider end-to-end) — *source : `TO_FIX.md` ligne 4 ; logique : `apps/tasks/views.py:113-122`*
- [ ] Toast de suppression ne s'affiche pas (à reproduire — le câblage `useDeleteWithUndo` + `t('tasks.deleted')` est en place) — *source : `TO_FIX.md` ligne 9 ; `ui/src/features/tasks/TasksPanel.tsx:87-103`*
- [ ] Statut par défaut à la création doit être `pending` (`À faire`) — vérifier que le formulaire envoie bien ce default — *source : `TO_FIX.md` ligne 11 ; `apps/tasks/models.py:38` (default backend OK)*
- [ ] Flash du layout avant l'empty state quand la liste est vide — *source : `TO_FIX.md` ligne 10*
- [ ] Icône calendrier (datepicker inline) peu visible en dark mode — *source : `TO_FIX.md` ligne 16*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Pouvoir lier directement un projet (select) dans la modale de création/édition — *source : `TO_FIX.md` ligne 2*
- [ ] Pouvoir attribuer la tâche à un membre du household depuis la modale — *source : `TO_FIX.md` ligne 3 ; `GITHUB_ISSUES_BACKLOG.md` FEAT-10*
- [ ] Dans les projets, le bouton « Nouvelle tâche » doit ouvrir la même modale que la page tasks — *source : `TO_FIX.md` ligne 5*
- [ ] Revoir le mécanisme « en cours → done » (aujourd'hui un même bouton inline) — *source : `TO_FIX.md` ligne 6*
- [ ] Mieux gérer les priorités : tri du plus haut au bas, suggestion IA — *source : `TO_FIX.md` ligne 8*
- [ ] Vérifier le lien tâche ↔ interaction (couverture côté UI/API) — *source : `TO_FIX.md` ligne 13*
- [ ] Revoir le comportement avec le backlog : sélecteur multi-statuts ou switch « à faire / backlog » à la création — *source : `TO_FIX.md` ligne 14*
- [ ] Tâches privées : exposer dans l'UI le filtre « mes tâches privées » via `is_private` + `created_by` — *source : `TO_FIX.md` ligne 15*
- [ ] Statut `in_progress` : décider s'il est permanent ou supprimé — *source : `TO_FIX.md` ligne 17*
- [ ] Permissions fines pour qui peut assigner les tâches — *source : `TO_FIX.md` ligne 20*
- [ ] Notifications sur assignation / complétion de tâches (parcours 06 V2) — *source : `TO_FIX.md` ligne 21 ; `GITHUB_ISSUES_BACKLOG.md` FEAT-10 ; `docs/TASK_V2.md`*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] Faire re-checker le modèle `Task` par l'IA (audit des contraintes / index) — *source : `TO_FIX.md` ligne 12*
- [ ] BUG-06 — Création d'une tâche sans due date : champ `due_date` est nullable côté `Task` mais le legacy mapping `occurred_at` → `metadata.due_date` peut encore poser problème dans certains points d'entrée — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-06*
- [ ] Documenter les patterns `useDeleteWithUndo` + `useSessionState` utilisés ici — *source : `GITHUB_ISSUES_BACKLOG.md` DOCS-01*

## Notes

- Décision V1 (parcours 03) : « les tâches restent des `Interaction` avec `type='todo'` » a été depuis dépassée — un modèle `Task` autonome existe (migration `0002_migrate_todos`). `source_interaction` (FK nullable) permet de garder la trace de l'origine pour les tâches migrées ou créées depuis un événement.
- Contraintes notables : `tasks_completed_integrity` (si `completed_at` set, `completed_by` doit l'être aussi) et `tasks_private_not_assigned` (une tâche privée ne peut pas être assignée).
- `pagination` : default 200 / max 500 (élevé) — vraisemblablement parce que le frontend gère le filtrage par section côté client.
- La page `TasksPage` est un wrapper minimal de `TasksPanel` (réutilisable côté projets).
- Suppression : soft-delete via `status='archived'` côté backend ; le frontend utilise `useDeleteWithUndo` + DELETE HTTP, donc l'undo restaure en repassant l'item en `pending` (à vérifier dans le hook `useDeleteTask`).
