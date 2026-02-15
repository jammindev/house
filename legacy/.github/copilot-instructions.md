# GitHub Copilot Instructions for House

House is a multi-tenant household knowledge management system built with Next.js 15 and Supabase. All data is scoped by `household_id` with strict RLS policies.

## Quick Start

```bash
# Development setup
cd nextjs && yarn dev                    # Start Next.js
yarn db:migrate                         # Apply DB migrations
yarn test:e2e                          # Run Playwright tests
```

## Architecture Principles

**RLS-First Security**: Every table requires `enable row level security` and policies that validate household membership via `household_members` table. Never expose service keys to browsers.

**Feature-First Organization**: Domain logic lives in `nextjs/src/features/<domain>/` with standardized subfolders:
- `components/` - React components
- `hooks/` - Custom hooks  
- `lib/` - Business logic
- `types/` - TypeScript definitions
- `utils/` - Utilities

Use path aliases: `@interactions/components/Form` instead of relative imports.

**Supabase Client Patterns**:
- Browser: `createSPASassClientAuthenticated()` for authenticated operations
- Server: `createSSRClient()` for RSC/server actions
- Admin: `createServerAdminClient()` only for service-role operations (server-only)

## Key Conventions

**Database Changes**: Always create migrations via `yarn db:new <name>`. Include table, RLS policies, and indexes in same migration. Example pattern:
```sql
create table example (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  -- other columns
);
alter table example enable row level security;
create policy "household_members_access" on example using (
  exists (select 1 from household_members where household_id = example.household_id and user_id = auth.uid())
);
```

**File Storage**: All uploads must use paths prefixed with `auth.uid()` to satisfy storage policies: `userId/interactionId/filename`.

**Interaction Creation**: Use `create_interaction_with_zones()` RPC for atomic creation with zone links, never raw INSERT statements.

**i18n**: Add keys to both `nextjs/src/lib/i18n/dictionaries/en.json` and `fr.json`. Use `useI18n()` hook: `const { t } = useI18n(); t('key.path')`.

**Navigation**: Wrap `/app` route links with `LinkWithOverlay` for loading states; use plain `Link` for external/auth URLs.

## Core Domain Models

- **households** + **household_members**: Multi-tenancy foundation
- **zones**: Hierarchical spaces with auto-inherited colors for nested levels
- **interactions**: Time-based entries (notes, todos, expenses) linked to zones
- **projects**: Collections of interactions with budget tracking and AI assistance
- **equipment**: Asset management with maintenance scheduling
- **documents**: File attachments with OCR text extraction (future)

## Testing Patterns

Playwright tests in `nextjs/tests/e2e/` use service-role seeding for isolated test data. Always clean up test households after runs.

## Common Gotchas

- `nextjs/src/lib/types.ts` is outdated - regenerate with `supabase gen types typescript --linked`
- Template routes (`/app/storage`, `/app/table`) still exist but are legacy - avoid using
- Server components by default; only add `"use client"` when browser APIs needed
- Always validate household membership in custom hooks/components
- Use `LinkWithOverlay` for internal navigation to show loading states

## File References

- Global context: `nextjs/src/lib/context/GlobalContext.tsx`
- Feature entry points: `nextjs/src/features/*/index.ts`
- Supabase helpers: `nextjs/src/lib/supabase/`
- Main migrations: `supabase/migrations/`
- Comprehensive docs: `AGENTS.md`, `AI_UPDATE_WORKFLOW.md`