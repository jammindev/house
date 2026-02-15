# Interactions Feature

## Purpose
Manages time-based household entries: notes, todos, calls, meetings, expenses, lifecycle events (maintenance, repairs, installations, etc.). Central domain for capturing all household activities with attachments, tagging, and context.

## Key Concepts
- **Interactions**: Chronological entries with subject, content, type, status, occurred_at timestamp
- **Types**: `note`, `todo`, `call`, `meeting`, `expense`, `maintenance`, `repair`, `installation`, `inspection`, `warranty`, etc.
- **Statuses**: `pending`, `in_progress`, `done`, `archived`
- **Zone Links**: Many-to-many relationship via `interaction_zones` table
- **Attachments**: Documents (photos, PDFs, etc.) linked via `interaction_documents`
- **Tags**: Flexible categorization via `interaction_tags` join table
- **Contacts & Structures**: Link interactions to people/companies via `interaction_contacts` and `interaction_structures`

## Architecture

### Components
- `InteractionForm`: Main creation/editing form with zone picker, type/status selectors, file uploads
- `InteractionList`: Filterable list with search, type/status filters, date ranges
- `InteractionDetail`: Full view with documents, zones, tags, contacts, structures
- `InteractionAssociations`: Display tags, contacts, structures badges
- `InteractionMetadata`: Status, type, date, project badges
- `ZonePicker`: Hierarchical zone selector with inline zone creation
- `ContactSelector`, `StructureSelector`: Multi-select pickers with search
- `InteractionTagsSelector`: Tag creation and selection
- `NewTaskDialog`: Quick task creation dialog

### Hooks
- `useInteractions()`: Loads all interactions for household with filtering (search, types, statuses, zones, dates, projects)
- `useInteraction(id)`: Single interaction with documents, zones, tags
- `useInteractionActions()`: CRUD operations (get, update, delete)

### Services
- `InteractionService`: Unified service layer for all interaction operations
- `InteractionQueries`: Reusable Supabase query builders
- `InteractionTransformers`: Data normalization and mapping
- `InteractionServiceUtils`: Helper utilities

### Types (`types.ts`)
- `Interaction`: Main interaction entity
- `InteractionType`: Union of all interaction types
- `InteractionStatus`: Union of status values
- `InteractionTag`, `InteractionContact`, `InteractionStructure`: Associated entities
- `Document`: Attachment metadata
- `InteractionListFilters`: Filter configuration for list views
- `InteractionProjectSummary`: Lightweight project info for interactions

### Constants
- `INTERACTION_TYPES`: Array of type definitions with labels, icons, colors
- `INTERACTION_STATUSES`: Status definitions with labels, icons, colors
- `DEFAULT_INTERACTION_FILTERS`: Default filter state

### Utils
- `datetime.ts`: Date formatting and timezone handling
- `amount.ts`: Expense amount parsing (handles comma/dot decimals)

## Database Schema
- Table: `interactions`
  - RLS: household members can CRUD interactions in their household
  - Audit: `created_at`, `updated_at`, `created_by`, `updated_by` auto-populated
  - Triggers: `update_interaction_metadata` maintains audit fields
- Join tables: `interaction_zones`, `interaction_tags`, `interaction_contacts`, `interaction_structures`, `interaction_documents`
- RPC: `create_interaction_with_zones(...)` for atomic creation

## Usage Patterns

### Create Interaction
```tsx
const { createInteraction } = useInteractionActions();
await createInteraction({
  householdId,
  subject: "Fix sink",
  content: "Leaking faucet",
  type: "maintenance",
  status: "pending",
  zoneIds: ["kitchen-id"],
  tagIds: ["urgent-id"],
});
```

### Filter Interactions
```tsx
const { interactions, filters, setFilters } = useInteractions();
setFilters({ 
  types: ["maintenance", "repair"],
  statuses: ["pending", "in_progress"],
  search: "leak",
});
```

### Update Interaction
```tsx
const { updateInteraction } = useInteractionActions();
await updateInteraction(interactionId, {
  status: "done",
  content: "Fixed - replaced washer",
});
```

## Import Aliases
- `@interactions/components/*`
- `@interactions/hooks/*`
- `@interactions/types`
- `@interactions/constants`
- `@interactions/utils/*`
- `@interactions/services`

## Related Features
- `zones`: Location context for interactions
- `projects`: Group interactions by project
- `documents`: File attachments
- `contacts`: Link people to interactions
- `structures`: Link companies/organizations
- `tasks`: Specialized view for todo-type interactions
- `equipment`: Link equipment to maintenance/repair interactions

## Routes
- `/app/interactions` - List view
- `/app/interactions/new` - Create new interaction
- `/app/interactions/[id]` - Detail view
- `/app/tasks` - Kanban board for todo interactions

## RLS & Security
- All queries filtered by `household_id` via RLS policies
- Storage: files must be prefixed with `auth.uid()` path
- Document deletion: only uploader can delete (storage owner-only policy)
- Interaction deletion: any household member can delete

## Future Enhancements
- OCR text extraction for documents (`enriched_text` field exists)
- Full-text search across `enriched_text`
- Recurring interactions (reminders, scheduled maintenance)
- Batch operations (bulk delete, status change)
- Export/import (CSV, JSON)
