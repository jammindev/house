# AI Contribution Workflow (SPA Architecture)

This file defines a safe process for AI-assisted changes in the active House repository.

## Principles

- Keep changes small and scoped.
- Prefer runtime truth over historical docs.
- Preserve household-scoped permissions for all domain updates.
- Avoid broad refactors unless explicitly requested.
- Update docs when behavior, APIs, or conventions change.

## Before changing code

1. Clarify goal, inputs/outputs, and acceptance criteria.
2. Identify affected areas:
   - Django models/migrations
   - DRF serializers/viewsets/permissions
   - React features in `ui/src/features/`
3. Confirm household permission implications.

## Data and permissions rules

- New business models should follow household scoping conventions.
- API routes must enforce member/owner semantics consistent with current app behavior.
- Never introduce cross-household access shortcuts.
- The middleware `ActiveHouseholdMiddleware` scopes all API requests via `request.household` — do not pass `householdId` as query param.

## Implementation pattern — Backend

1. Read active routes and serializers first (`config/urls.py`, app `urls.py`, serializers/viewsets).
2. Implement minimal code changes in active stack (DRF ViewSets only).
3. No `views_web.py` or `web_urls.py` — the hybrid architecture has been removed.

## Implementation pattern — Frontend

### TanStack Query conventions

Always use TanStack Query hooks — never use `fetch` or `axios` directly inside a component.

**queryKeys pattern:**
```typescript
export const fooKeys = {
  all: ['foo'] as const,
  list: (filters?) => [...fooKeys.all, 'list', filters] as const,
  detail: (id: string) => [...fooKeys.all, 'detail', id] as const,
};
```

**hooks pattern:**
```typescript
// hooks.ts
export function useFooList(filters?) {
  return useQuery({ queryKey: fooKeys.list(filters), queryFn: () => fetchFooList(filters) });
}

export function useCreateFoo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFoo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fooKeys.all }),
  });
}
```

### React Router conventions

All routes are defined in `ui/src/router.tsx`. To add a new route:
1. Import the page component.
2. Add the route inside the appropriate layout (`ProtectedLayout` for authenticated pages).
3. Routes under `/app/*` are protected and redirect to `/login` if not authenticated.

### PageLayout usage

Wrap page content with `PageLayout` for consistent headers:
```tsx
<PageLayout title="My Page" actions={<Button>Add</Button>}>
  {/* page content */}
</PageLayout>
```

### Data fetching pattern

```tsx
export default function MyPage() {
  const { data: items = [], isLoading } = useFooList();

  if (isLoading) return <ListSkeleton />;
  // ...
}
```

- `loading` state is managed by TanStack Query — no manual `useState` for loading.
- No `initialItems` props — React always fetches from the API on mount.

## Required documentation updates

When relevant, update:

- `docs/ARCHITECTURE.md` for architecture or convention changes
- `docs/AI_CONTEXT_API.md` for API changes
- app-level README when a module has specific operational rules

## Validation checklist

- Django checks/tests for touched areas (`manage.py check`, targeted tests)
- No unrelated file churn
- Permissions still enforce household membership constraints
- UI routes and API endpoints remain consistent with docs
- New features use TanStack Query hooks (not raw fetch)
- New routes added to `ui/src/router.tsx`

## When to request human input

- Ambiguous permission model changes
- Data migrations transforming existing production records
- External provider/security/billing decisions
- Product tradeoffs not inferable from active codebase
