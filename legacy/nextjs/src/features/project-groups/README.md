# Project Groups Feature

## Purpose
Groups multiple related projects for portfolio/program management.

## Key Concepts
- **Groups**: Collections of projects with shared theme/goal
- **Rollup Metrics**: Aggregate budget, task counts across projects
- **Tags**: Categorize groups

## Architecture

### Components
- `ProjectGroupCard`: Summary with project count, budget
- `ProjectGroupForm`: Create/edit form
- `ProjectGroupDetail`: List of grouped projects

### Hooks
- `useProjectGroups()`: Loads groups for household

### Types
- `ProjectGroup`: Main entity
- `ProjectGroupMetrics`: Aggregated stats

## Database Schema
- Table: `project_groups`
  - RLS: household members can CRUD groups
- View: `project_group_metrics` - rollup calculations

## Import Aliases
- `@project-groups/components/*`
- `@project-groups/hooks/*`

## Related Features
- `projects`: Projects can belong to groups
