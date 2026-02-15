# Shared Feature Components

## Purpose
Common UI components, layouts, and utilities shared across all features.

## Contents

### Components (`components/`)
- `EmptyState`: Consistent empty state with icon, message, CTA
- `LoadingSpinner`: Loading indicators
- `ErrorBoundary`: Error handling wrapper
- `ConfirmDialog`: Reusable confirmation dialog
- `SearchInput`: Debounced search field
- `DatePicker`: Date selection component
- `ColorPicker`: Color selection with presets

### Layout (`layout/`)
- `AppPageLayout`: Standard page layout with header, sidebar, content area
- `ResourcePageShell`: List/detail page template
- `ListPageLayout`: Grid/list view container
- `DetailPageLayout`: Entity detail page template
- `TabLayout`: Tabbed content container

### Hooks (`hooks/`)
- `usePersistentFilters()`: Filter state with localStorage sync
- `useDebounce()`: Debounced value hook
- `useLocalStorage()`: Typed localStorage hook
- `useMediaQuery()`: Responsive breakpoint detection

### Utils (`utils/`)
- `cn()`: Tailwind class name merging
- `formatDate()`: Locale-aware date formatting
- `generateId()`: UUID generation

## Import Aliases
- `@shared/components/*`
- `@shared/layout/*`
- `@shared/hooks/*`
- `@shared/utils/*`

## Usage Guidelines
- **EmptyState**: Use for all empty lists/grids
  ```tsx
  <EmptyState
    icon={FileIcon}
    title="No documents"
    description="Upload your first document"
    action={<Button>Upload</Button>}
  />
  ```

- **Page Layouts**: Wrap route components
  ```tsx
  <ListPageLayout
    title="Interactions"
    actions={<Button>New</Button>}
    filters={<InteractionFilters />}
  >
    <InteractionList />
  </ListPageLayout>
  ```

- **Persistent Filters**: Use for all list views
  ```tsx
  const { filters, setFilters } = usePersistentFilters({
    key: "interaction-filters",
    fallback: DEFAULT_FILTERS,
    scope: householdId, // Clear on household switch
  });
  ```

## Conventions
- All shared components are presentational (no data fetching)
- Props typed with TypeScript
- Accessible (ARIA labels, keyboard nav)
- Responsive by default
- Theme-aware (uses CSS variables)

## Related Files
- `components/ui/*`: shadcn/ui primitives (Button, Input, Card, etc.)
- `components/layout/*`: App-level layout (Sidebar, Header, etc.)
