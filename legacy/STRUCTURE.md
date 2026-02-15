# House Project Structure

This document summarizes how the repository is organized today and highlights the shared presentation primitives introduced for the feature pages (contacts, interactions, projects, project groups, …).

## 1. Repository Layout

```
house/
├─ README.md               -> product overview and setup
├─ STRUCTURE.md            -> (you are here) repo and UI structure guidelines
├─ nextjs/                 -> Next.js 15 application
│  ├─ src/
│  │  ├─ app/              -> App Router entrypoints (routes, layouts, API handlers)
│  │  ├─ features/         -> Feature-first slices (contacts, interactions, projects, …)
│  │  ├─ components/       -> Shared UI primitives (shadcn/ui wrappers, layout shell)
│  │  ├─ lib/              -> Supabase clients, contexts, i18n, utilities
│  │  └─ styles/           -> Tailwind globals
│  └─ tests/               -> Playwright e2e coverage
├─ supabase/               -> Database migrations, policies, storage config
└─ …                       -> Project meta (AI instructions, backlog, etc.)
```

### 1.1 `src/app`

- Routes follow the App Router convention.
- `app/app/page.tsx` is a lightweight redirect to `/app/dashboard` so the authenticated root stays stable.
- Feature routes live in `app/app/(pages)/<feature>/page.tsx` (e.g., `dashboard`, `contacts`, `projects`, `photos`, `documents`, `zones`, …). Group folders such as `(pages)` are purely organizational and do not affect the URL.
- Server routes live under `app/api`.
- Layout context is provided by `app/app/(pages)/layout.tsx` which exposes setters consumed by the shared shells.

### 1.2 `src/features`

Feature slices gather domain-specific logic:

```
features/
├─ contacts/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  └─ types.ts
├─ interactions/
├─ projects/
├─ project-groups/
└─ _shared/
   ├─ components/          -> EmptyState, skeletons, dialogs…
   └─ layout/              -> ResourcePageShell, ListPageLayout, DetailPageLayout
```

Each feature exports hooks and UI components so App Router entrypoints stay thin.

### 1.3 `@shared` Namespace

`nextjs/tsconfig.json` defines the `@shared/*` alias that points to `features/_shared/*`. This slice contains the primitives that harmonize page shells:

- `ResourcePageShell`: synchronises page metadata (title, subtitle, actions, loader) with `AppPageLayout` via the layout context.
- `ListPageLayout`: standard list surface with toolbar slot, skeleton/empty states, error handling, and optional layout loading sync.
- `DetailPageLayout`: detail view wrapper with integrated error, not-found fallback, and optional aside column.
- Skeletons (`ListSkeleton`, `DetailSkeleton`) and `EmptyState` are used across domains for consistent loading and empty-state visuals.

## 2. Page Layout Flow

1. App routes under `app/(pages)` call into feature code.
2. Feature routes wrap their content with `ListPageLayout`, `DetailPageLayout`, or `ResourcePageShell`.
3. These shared layouts propagate configuration to `AppPageLayout` through `usePageLayoutConfig`, ensuring:
   - titles, subtitles, context, actions, and back button state stay consistent,
   - loading indicators are opt-in via `syncLayoutLoading`,
   - empty/error states reuse the same UI primitives.

Result: contacts, interactions, projects, and project groups now share a common layout structure while keeping domain logic modular.

## 3. How to Add a New Feature Page

1. Create a slice under `features/<domain>` with `components/`, `hooks/`, `types.ts`.
2. Expose hooks (`use<Domain>`) that encapsulate Supabase access and state.
3. Build React components that render the domain UI.
4. In `app/(pages)/<domain>`, import the components/hooks and wrap the page with `ListPageLayout` or `DetailPageLayout`.
5. Use `EmptyState`, skeletons, and the standard action definitions to match the rest of the product.

## 4. When to Sync Loading to the Global Layout

`ListPageLayout` and `DetailPageLayout` forward the `loading` prop to `AppPageLayout` only when `syncLayoutLoading` is set. Most list/detail pages now use in-surface skeletons rather than blocking the entire layout. Use `syncLayoutLoading` sparingly (for full-screen workflows such as wizards).

## 5. Documentation Pointers

- For a high-level product summary and roadmap: `AGENTS.md`.
- For AI-focused contribution workflow: `AI_UPDATE_WORKFLOW.md`.
- For detailed schema and RLS policies: see `supabase/migrations/*`.
- For detailed page-construction guidance (layouts, shells, examples): [`PAGE_LAYOUTS.md`](./PAGE_LAYOUTS.md).

Keep this file updated when significant structural changes land so contributors have a quick, centralized reference.
