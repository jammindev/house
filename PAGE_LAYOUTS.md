# Page Construction Guide

This document explains how application pages in **House** are composed today, which shared shells to use, and how to wire domain-specific UI so every feature retains a consistent look and feel.

## 1. Layout Stack Overview

1. **App router layout**  
   - `nextjs/src/app/app/(pages)/layout.tsx` wraps the authenticated section.  
   - It exposes setters (`usePageLayout`) for title, subtitle, actions, loading states, etc., and renders `AppPageLayout`.
2. **Shared page shells**  
   - Feature routes under `app/(pages)` import the shells from `@shared/layout/*` to configure the layout context declaratively.
3. **Feature components**  
   - Domain-specific UI (lists, detail panels, forms) lives under `nextjs/src/features/<domain>`.

## 2. Shared Shells

All shells live in `nextjs/src/features/_shared/layout`.

### `ResourcePageShell`
- Synchronises layout metadata (title, subtitle, context, actions, loading) with the app layout.
- Accepts `bodyClassName` to control page spacing, plus `syncLayoutLoading` when you really need the top-level spinner.
- Use it for simple pages (forms, dashboards, wizards) or when composing custom structures manually.

### `ListPageLayout`
- Builds on `ResourcePageShell` to standardize list views.
- Props cover toolbar slot, loading skeleton, empty state, and error banner.
- Typical usage:
  ```tsx
  <ListPageLayout
    title={t("contacts.title")}
    subtitle={t("contacts.subtitle")}
    hideBackButton
    actions={[{ icon: Plus, href: "/app/contacts/new" }]}
    toolbar={<ContactsFilters ... />}
    loading={loading}
    isEmpty={!loading && contacts.length === 0}
    emptyState={<ContactsEmptyState />}
    error={error}
    errorTitle={t("contacts.loadFailed")}
  >
    <ContactList contacts={contacts} ... />
  </ListPageLayout>
  ```

### `DetailPageLayout`
- Standardizes detail pages with optional `aside` section and not‑found fallback.
- Handles errors and loading states (with in-surface skeleton) while keeping actions aligned with the header.
- Example: zone, project, interaction detail pages.

## 3. Supporting Components

Located in `nextjs/src/features/_shared/components`:

- `EmptyState`: icon + message + optional CTA for consistent empty states.
- `ListSkeleton`, `DetailSkeleton`: used by `ListPageLayout`/`DetailPageLayout` but can be reused directly.
- `ConfirmDialog`, `EntityDeleteButton`, etc., live alongside other shared primitives for feature reuse.

## 4. Loading Philosophy

- Prefer in-surface skeletons or placeholders so headers remain visible while data loads.
- `ResourcePageShell` includes `syncLayoutLoading`. When `false` (default) the layout skeleton is disabled; set to `true` only when you need to block the entire page (e.g., critical wizard step).
- Feature hooks (`useInteractions`, `useProjects`, …) expose `loading` flags to feed into the shells.

## 5. Building a New Page

1. Implement data hooks in the relevant feature slice.
2. Create feature components (lists, detail view, forms) under `features/<domain>/components`.
3. In the route file (`app/(pages)/<domain>/*.tsx`):
   - Import the appropriate shell.
   - Pass translations, actions, loading/error flags, empty states, and domain components.
   - Avoid manipulating `usePageLayoutConfig` directly unless you need a custom flow—otherwise stick to the shells.
4. Add locale strings (`en.json`, `fr.json`) for titles, subtitles, empty/error messages, and actions.

## 6. Examples

- **Contacts list**: `app/(pages)/contacts/page.tsx` -> `ListPageLayout`.
- **Projects detail**: `app/(pages)/projects/[id]/page.tsx` -> `DetailPageLayout` with not-found state.
- **Dashboard**: `app/app/page.tsx` -> `ResourcePageShell` with custom cards.
- **Zones**: list uses `ResourcePageShell` with inline components; detail uses `DetailPageLayout`.

Refer to these files when implementing new pages to keep the UX consistent across the product. 

