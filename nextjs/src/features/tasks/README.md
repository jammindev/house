# Tasks Feature

## Purpose
Specialized view for `todo`-type interactions with kanban board and status management.

## Key Concepts
- **Tasks**: Interactions where `type = 'todo'`
- **Kanban**: Board with columns for `backlog`, `pending`, `in_progress`, `done`, `archived`
- **Drag-and-Drop**: Status updates via board movement

## Architecture

### Components
- `TaskBoard`: Kanban layout with drag-and-drop
- `TaskCard`: Compact card with status badges
- `TaskFilters`: Filter by zone, project, tags

### Hooks
- `useTasks()`: Filtered query for todo interactions
- `useTaskBoard()`: Board state management

## Import Aliases
- `@tasks/components/*`
- `@tasks/hooks/*`

## Related Features
- `interactions`: Tasks are todo-type interactions
- `projects`: Tasks can be project-linked

## Routes
- `/app/tasks` - Kanban board
