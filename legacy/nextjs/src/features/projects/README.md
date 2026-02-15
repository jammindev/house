# Projects Feature

## Purpose
Groups related interactions (tasks, notes, expenses, documents) under a project umbrella. Tracks budget, progress, and provides AI-assisted project management.

## Key Concepts
- **Projects**: Containers for related interactions with title, description, dates, budget
- **Status**: `draft`, `planning`, `active`, `on_hold`, `completed`, `cancelled`
- **Priority**: 1-5 scale (1 = highest)
- **Budget Tracking**: `planned_budget` vs `actual_cost_cached` (auto-updated from expense interactions)
- **Cover Image**: Optional `cover_interaction_id` for visual representation
- **Project Groups**: Optional grouping of multiple projects

## Architecture

### Components
- `ProjectCard`: Summary card with progress, budget, dates
- `ProjectForm`: Create/edit form with metadata, dates, budget
- `ProjectList`: Filterable list with status/priority/date filters
- `ProjectDetail`: Tabs (Overview, Tasks, Documents, Expenses) with timeline
- `ProjectQuickActions`: Buttons to create task/note/expense/document linked to project
- `ProjectBudgetIndicator`: Visual progress bar comparing planned vs actual costs
- `ProjectGroupSelector`: Group assignment picker

### Hooks
- `useProjects()`: Loads all projects for household with filtering
- `useProject(id)`: Single project with full details
- `useProjectInteractions(id)`: Filtered interactions (tasks, expenses, documents) for project
- `useDeleteProject()`: Project deletion with cascade handling
- `useProjectTabState()`: Manages active tab state

### Sub-features
- `ai-chat`: AI assistant for project management (lives in `features/ai-chat/`)
  - `AIChatDialog`: Chat interface with conversation history
  - `useAIChat()`: Manages chat state, message sending, streaming responses
  - Tables: `project_ai_threads`, `project_ai_messages`
  - API: `/api/projects/[id]/ai-chat`

### Types (`types.ts`)
- `Project`: Main entity
- `ProjectStatus`: Union of status values
- `ProjectPriority`: 1-5 integer
- `ProjectMetrics`: Aggregated stats (task counts, budget, documents)
- `AIThread`, `AIMessage`: Chat conversation types

### Constants
- `PROJECT_STATUSES`: Status definitions with labels, colors, icons
- `PROJECT_PRIORITIES`: Priority labels and colors

## Database Schema
- Table: `projects`
  - RLS: household members can CRUD projects
  - Triggers: 
    - `set_project_created_by`, `set_project_updated_by`: audit fields
    - `sync_project_closed_at`: auto-sets `closed_at` when status = `completed`
    - `refresh_project_actual_cost`: recalculates `actual_cost_cached` when linked expenses change
  - Check: `priority` between 1 and 5
- View: `project_metrics` - aggregates task/document counts and budget info
- Tables: `project_ai_threads`, `project_ai_messages` for AI chat

## Usage Patterns

### Create Project
```tsx
await createProject({
  household_id: householdId,
  title: "Kitchen Renovation",
  description: "Full kitchen remodel",
  status: "planning",
  priority: 2,
  planned_budget: 15000,
  start_date: "2024-01-01",
  due_date: "2024-03-31",
});
```

### Link Interaction to Project
```tsx
// When creating interaction
await createInteraction({
  ...,
  project_id: projectId,
});

// Or update existing interaction
await updateInteraction(interactionId, {
  project_id: projectId,
});
```

### AI Chat
```tsx
const { sendMessage, messages, loading } = useAIChat(projectId);
await sendMessage("What should I prioritize next?");
```

## Import Aliases
- `@projects/components/*`
- `@projects/hooks/*`
- `@projects/types`
- `@projects/constants`

## Related Features
- `interactions`: All interactions can be linked to projects via `project_id`
- `project-groups`: Optional grouping of related projects
- `documents`: Project documents via linked interactions
- `ai`: Shared AI utilities for chat functionality

## Routes
- `/app/projects` - List view
- `/app/projects/new` - Create new project
- `/app/projects/[id]` - Detail view with tabs

## RLS & Security
- Project CRUD: household membership required
- AI threads: users can only access their own threads within their household projects
- API: `/api/projects/[id]/ai-chat` validates project membership before processing

## Budget Tracking
- `actual_cost_cached` auto-updates via trigger when expense interactions change
- Trigger watches: INSERT, UPDATE, DELETE on `interactions` where `type = 'expense'` and `project_id` matches
- Formula: `SUM((metadata->>'amount')::numeric)` from expense interactions

## AI Assistant
- Requires `OPENAI_API_KEY` environment variable
- Context: gathers project details + recent interactions
- Streaming: SSE responses for real-time feedback
- History: conversation threads persisted in database
- Auto-titles: first message becomes thread title

## Future Enhancements
- Gantt chart view for project timeline
- Dependency tracking between tasks
- Budget allocation by category
- Progress calculation based on completed tasks
- Project templates
- Recurring projects (annual maintenance, etc.)
