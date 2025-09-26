# AGENTS.md — Project Context for AI Assistants

This document gives AI and contributors a compact, high-signal overview of the repository: goals, architecture, schema, routes, conventions, and current gaps. Use it to understand the project quickly and to propose changes safely.

If you are an AI planning to change code, also read AI_UPDATE_WORKFLOW.md for the step-by-step update process and checklists.

## 1) Product Summary
- Name: House
- Purpose: Centralize household knowledge (journal entries with attachments and zone tagging). Current build supports multi-tenant households, entry capture, attachments, and zone management. Full-text search, OCR, renovation projects, budgeting, reminders, and maintenance dashboards are still future phases.
- Multi-tenancy: Users belong to one or more households via `household_members`; all content is scoped by `household_id` and protected with RLS.

## 2) Repository Layout
- Root scripts: `package.json` orchestrates Next.js and Supabase CLI (`dev|build|start` → `cd nextjs && yarn ...`, `db:migrate`, `db:reset`, `db:new`, `tree`).
- Frontend app: `nextjs/` (Next.js 15 App Router, React 19, Tailwind, shadcn/ui, custom i18n).
  - Auth: `nextjs/src/app/auth/*`
  - Dashboard + product: `nextjs/src/app/app/*` (households, zones, entries, storage demo, todo demo).
  - Entries flow: `nextjs/src/app/app/entries/{page.tsx,new/[id]}`.
  - API routes: `nextjs/src/app/api/households/route.ts` and the template `api/auth/callback`.
  - Supabase helpers: `nextjs/src/lib/supabase/{client,server,serverAdminClient,unified}.ts`.
  - Global household context: `nextjs/src/lib/context/GlobalContext.tsx`.
  - i18n dictionaries: `nextjs/src/lib/i18n/dictionaries/{en,fr}.json`.
- Supabase project: `supabase/`
  - Migrations define households, members, zones (with parent/creator), entries, entry_zones, entry_files, RPCs, and storage policies. Legacy template artifacts (`todo_list`) remain.
  - `supabase/config.toml` configures local dev, bucket `files`, and auth settings.
- Docs & meta: `instructions.md`, `AI_UPDATE_WORKFLOW.md`, `README.md` (still upstream template content).
- CI: none; `.github/ISSUE_TEMPLATE` only.

## 3) Tech Stack
- Frontend: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Lucide icons, custom i18n provider.
- Backend: Supabase (Postgres 17, RLS policies, Storage buckets, Auth).
- Tooling: TypeScript 5, ESLint 9, PostCSS, Yarn. Supabase CLI for migrations/RPCs.

## 4) Environment & Secrets
- Copy `nextjs/.env.template` → `nextjs/.env.local` and provide:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `PRIVATE_SUPABASE_SERVICE_KEY`
- Template variables (`NEXT_PUBLIC_PRODUCTNAME`, `NEXT_PUBLIC_THEME`, billing tier settings, etc.) are still present; adjust or remove them for House branding before production.
- Never commit `.env.local`.
- Supabase linking workflow: `npx supabase login`, `npx supabase link`, `npx supabase config push`, `npx supabase migrations up --linked`.

## 5) Database Model (RLS-first)
_All domain tables live in the `public` schema with RLS enabled. Membership determines access._

- `households`
  - Columns: `id uuid pk`, `name text not null`, `created_at timestamptz default now()`.
  - RLS: select restricted to users with a membership; insert allowed for any authenticated user.

- `household_members`
  - Columns: `household_id uuid`, `user_id uuid`, `role text default 'member'`, PK `(household_id, user_id)`.
  - RLS: users can select their memberships and insert themselves.
  - Policies on `households` rely on this table to authorize access.

- `zones`
  - Columns: `id uuid pk`, `household_id uuid`, `name text`, `parent_id uuid nullable` (same-household FK), `created_at timestamptz`, `created_by uuid`.
  - Trigger `trg_zones_set_created_by` populates `created_by = auth.uid()`.
  - RLS: members of the household may select/insert/update; delete is limited to the creator.

- `entries`
  - Columns: `id uuid pk`, `household_id uuid`, `raw_text text`, `enriched_text text`, `metadata jsonb default '{}'`, audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`).
  - Trigger `update_entry_metadata` keeps `updated_at` and `updated_by` in sync.
  - RLS: members can select/insert/update; delete requires membership *and* `created_by = auth.uid()`.

- `entry_zones`
  - Join table `(entry_id uuid fk → entries on delete cascade, zone_id uuid fk → zones on delete cascade)` with PK `(entry_id, zone_id)`.
  - RLS: membership is validated via the related entry.
  - Triggers ensure entries always retain at least one zone after deletes/updates.

- `entry_files`
  - Columns: `id uuid pk`, `entry_id uuid fk`, `storage_path text`, `mime_type text`, `ocr_text text`, `metadata jsonb default '{}'`, `created_at`, `created_by uuid`.
  - Trigger `set_entry_file_created_by` fills `created_by = auth.uid()`.
  - RLS: household members may select/insert/update/delete files for entries in their household.

- Storage bucket `files`
  - Owner-only access enforced by policies that restrict CRUD to paths prefixed with the uploader’s `auth.uid()`.
  - UI stores files at `userId/entryId/<uuid>_filename` to stay within policy constraints.

- Legacy template tables: `todo_list` (from the SaaS starter) still exists with owner-only policies and is used by `/app/table`. It is not part of the House domain.

- Functions & helpers
  - `create_entry_with_zones(p_household_id, p_raw_text, p_zone_ids uuid[])`: inserts an entry and its zone links atomically after validating membership and zone ownership; returns the entry UUID. Used by the “new entry” form.

## 6) App Architecture (Next.js)
- Root layout (`nextjs/src/app/layout.tsx`) wraps pages with the i18n provider, cookie banner, and analytics integration. Theme/product name still come from SaaS template environment variables.
- Global context (`GlobalContext`) loads the current user, their households, and manages the selected household (stored in `localStorage`).
- Routes under `/auth/*` provide login/registration flows from the template; `/legal/*` hosts markdown legal pages.
- `/app` dashboard aggregates recent entries and zone counts for the selected household with quick links.
- Entries UI (`/app/entries`): list view limited to 50 recent entries, shows attachment counts. Detail view loads zones and previews attachments (image/pdf) via signed URLs and enforces creator-only deletion. `/app/entries/new` creates entries with zone selection, inline zone creation, and attachment upload (client uploads to storage then inserts rows into `entry_files`).
- Zones UI (`/app/zones`): manage zones, including optional parent assignment. Only the creator can delete a zone; others see an informational dialog.
- Household flows: `/app/households/new` posts to `/api/households` to create a household plus membership via the service-role client.
- Template demos: `/app/storage` (personal file bucket) and `/app/table` (todo list) still exist from the upstream template and operate on template schema. They are unrelated to the House domain and should be hidden or removed before launch.
- i18n: `I18nProvider` wraps the tree; dictionaries in `lib/i18n/dictionaries` include keys for dashboard, entries, zones, storage, etc. Locale persists in `localStorage`.

## 7) API & Edge Functions
- `POST /api/households`: server action that authenticates the caller, inserts a household via the service-role client, and enrolls the requester as owner.
- `GET /api/auth/callback`: template Supabase auth callback route; untouched.
- No dedicated API routes for entries/zones/files—client components interact directly with Supabase (RLS-enforced).
- No edge functions or background workers yet. OCR, enrichment, and search remain future work.

## 8) Conventions & Guidelines
- RLS-first: every new table must ship with RLS and policies mirroring membership rules. Prefer explicit policies over broad ones.
- Membership-driven access: when authoring SQL, join to `household_members` and use `auth.uid()` checks. Reuse the `create_entry_with_zones` RPC for atomic entry creation.
- Storage: keep uploaded file keys namespaced by user ID to satisfy storage policies. Sanitize filenames (see `entries/new/page.tsx`).
- Supabase clients:
  - Browser: use `createSPASassClientAuthenticated` for authenticated SPA operations.
  - Server components/routes: use `createSSRClient`; use `createServerAdminClient` sparingly for service-role operations.
- Types: `nextjs/src/lib/types.ts` still reflects the template (`todo_list` only). Regenerate types (`supabase gen types typescript --linked`) when schema changes to maintain type safety.
- UI: server components by default; mark interactive pages as client components (`"use client"`). Keep translations in sync across `en`/`fr` dictionaries.

## 9) How to Run Locally
1. Supabase (first time per machine/project)
   - `npx supabase login`
   - `npx supabase link`
   - `npx supabase config push`
   - `npx supabase migrations up --linked`
2. Frontend
   - `cd nextjs && yarn`
   - Copy `.env.template` → `.env.local` and fill Supabase keys + branding vars.
   - `yarn dev` then open `http://localhost:3000`.

## 10) Roadmap / TODOs (High Priority)
- Search: add `search_vector`, trigger maintenance, and a `/search` UI for entries.
- OCR & enrichment: implement file processing pipeline (edge function or background worker) to populate `entry_files.ocr_text` / `entries.enriched_text`.
- Entry maintenance: add edit/update flows (including zone reassignment and attachment management) and consider pagination beyond the latest 50 entries.
- Household management: surface household list, invitations, role management, and ability to switch default household via the UI.
- Schema/types hygiene: regenerate `Database` types, remove unused template tables/routes (`todo_list`, `/app/table`, `/app/storage`) once House features replace them.
- Quality & operations: add automated testing (unit/integration), lint/test scripts in CI, production-ready logging/monitoring, and update `README.md` to describe House instead of the upstream SaaS template.

## 11) Risks & Constraints
- Do not modify the Supabase `auth` schema. Reference `auth.users` but avoid schema changes there.
- Service-role usage (`createServerAdminClient`) must remain limited to trusted server contexts; never expose the service key to the browser.
- Storage security depends on file paths prefixed with `auth.uid()`; ensure any new uploads follow the same convention.
- Entry and zone deletions are creator-only—UI must continue to respect that constraint to avoid authorization errors.
- `nextjs/src/lib/types.ts` is outdated; relying on it for new queries can cause runtime/type mismatches until regenerated.
- Template routes (storage, todo) are still exposed. Disable or guard them before production to prevent confusing or insecure flows.

## 12) Helpful File Pointers
- Entries list: `nextjs/src/app/app/entries/page.tsx`
- Entry creation: `nextjs/src/app/app/entries/new/page.tsx`
- Entry detail + deletion: `nextjs/src/app/app/entries/[id]/page.tsx`
- Zones management: `nextjs/src/app/app/zones/page.tsx`
- Household creation API: `nextjs/src/app/api/households/route.ts`
- Supabase browser client wrapper: `nextjs/src/lib/supabase/client.ts`
- Global household context: `nextjs/src/lib/context/GlobalContext.tsx`
- Entry files schema/policies: `supabase/migrations/20250924090000_create_entry_files.sql`
- Entry creation RPC: `supabase/migrations/20250924111500_create_entry_with_zones_rpc.sql`
- Storage policies: `supabase/migrations/20250924093000_fix_storage_policies_owner_only.sql`

## 13) Prompts AI Should Ask Before Changes
- Which household access patterns must the change support?
- Does the new data access path require RLS adjustments or a new policy/RPC?
- Which Supabase client (browser/server/admin) is appropriate for the data flow?
- How should the UX fit into existing routes/components and i18n keys?
- Will schema changes require new migrations, regenerated types, or storage policy updates?

## 14) I18n Setup
- Library: custom provider at `nextjs/src/lib/i18n/I18nProvider.tsx` with `useI18n()` hook.
- Locales: English (`en`, default) and French (`fr`). Dictionaries live in `nextjs/src/lib/i18n/dictionaries/{en,fr}.json`.
- Provider: added in `app/layout.tsx`; locale persists in `localStorage` as `locale` and updates `<html lang>`.
- Usage example: `const { t } = useI18n(); t('dashboard.welcome', { name: 'Alice' })`.
