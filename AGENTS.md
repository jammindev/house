# AGENTS.md — Project Context for AI Assistants

This document gives AI and contributors a compact, high-signal overview of the repository: goals, architecture, schema, routes, conventions, and current gaps. Use it to understand the project quickly and to propose changes safely.

If you are an AI planning to change code, also read AI_UPDATE_WORKFLOW.md for the step-by-step update process and checklists.

## 1) Product Summary
- Name: House
- Purpose: Centralize household knowledge (chronological interactions with attachments, tagging, and context). Current build supports multi-tenant households, interaction capture, attachments, and zone management. Full-text search, OCR, renovation projects, budgeting, reminders, and maintenance dashboards are still future phases.
- Multi-tenancy: Users belong to one or more households via `household_members`; all content is scoped by `household_id` and protected with RLS.

## 2) Repository Layout
- Root scripts: `package.json` orchestrates Next.js and Supabase CLI (`dev|build|start` → `cd nextjs && yarn ...`, `db:migrate`, `db:reset`, `db:new`, `tree`).
- Frontend app: `nextjs/` (Next.js 15 App Router, React 19, Tailwind, shadcn/ui, custom i18n).
  - Auth: `nextjs/src/app/auth/*`
  - Dashboard + product: `nextjs/src/app/app/*` (households, zones, interactions, storage demo, todo demo).
  - Interactions flow: `nextjs/src/app/app/interactions/{page.tsx,new/[id]}`.
  - API routes: `nextjs/src/app/api/households/route.ts` and the template `api/auth/callback`.
  - Supabase helpers: `nextjs/src/lib/supabase/{client,server,serverAdminClient,unified}.ts`.
  - Global household context: `nextjs/src/lib/context/GlobalContext.tsx`.
  - i18n dictionaries: `nextjs/src/lib/i18n/dictionaries/{en,fr}.json`.
- Supabase project: `supabase/`
  - Migrations define households, members, zones (with parent/creator), interactions, interaction_zones, documents, RPCs, and storage policies. Legacy template artifacts (`todo_list`) remain.
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
  - Columns: `id uuid pk`, `household_id uuid`, `name text`, `parent_id uuid nullable` (same-household FK), `note text`, `surface numeric check (surface >= 0)`, `color text not null default '#f4f4f5'` (hex), `created_at timestamptz`, `created_by uuid`.
  - Color model: first-generation children of root zones store a user-selected base color while deeper descendants automatically inherit lightened shades of their parent.
  - Trigger `trg_zones_set_created_by` populates `created_by = auth.uid()`.
  - RLS: members of the household may select/insert/update/delete zones for their household; delete is no longer restricted to the creator.

- `interactions`
  - Columns: `id uuid pk`, `household_id uuid`, `subject text`, `content text`, `type text`, `status text nullable`, `occurred_at timestamptz`, `tags text[]`, `metadata jsonb default '{}'`, `enriched_text text`, `project_id uuid nullable`, audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`).
  - Trigger `update_interaction_metadata` keeps `updated_at` and `updated_by` in sync.
  - RLS: members can select/insert/update/delete interactions within their household.

- `interaction_zones`
  - Join table `(interaction_id uuid fk → interactions on delete cascade, zone_id uuid fk → zones on delete cascade)` with PK `(interaction_id, zone_id)`.
  - RLS: membership is validated via the related interaction.
  - Triggers ensure surviving interactions always retain at least one zone after deletes/updates.

- `documents`
  - Columns: `id uuid pk`, `interaction_id uuid fk`, `file_path text`, `name text`, `notes text`, `mime_type text`, `type text`, `metadata jsonb default '{}'`, `ocr_text text`, `created_at`, `created_by uuid`.
  - Trigger `set_document_created_by` fills `created_by = auth.uid()`.
  - RLS: household members may select/insert/update/delete documents linked to interactions in their household.
- `zone_documents`
  - Join table `(zone_id uuid fk → zones on delete cascade, document_id uuid fk → documents on delete cascade)` with PK `(zone_id, document_id)`, `role text default 'photo'`, `note text`, audit columns.
  - Trigger ensures linked documents belong to the same household and have `type = 'photo'`; `created_by` auto-populated.
  - RLS: household members can select/insert/update/delete zone documents when they belong to their household; policies validate membership on the owning zone.

- `projects`
  - Columns: `id uuid pk`, `household_id uuid`, `title text not null`, `description text`, `status project_status default 'draft'`, `priority int check (1 <= value <= 5)`, `start_date date`, `due_date date`, `closed_at timestamptz`, `tags text[]`, `planned_budget numeric(12,2)`, `actual_cost_cached numeric(12,2)`, `cover_interaction_id uuid nullable`, audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`).
  - Triggers populate `created_by`/`updated_by`, keep `closed_at` in sync when status moves to `completed`, and ensure the optional cover interaction belongs to the same household.
  - `refresh_project_actual_cost` trigger recalculates `actual_cost_cached` whenever linked expense interactions change.
  - RLS: household members can select/insert/update/delete projects scoped to their household.

- `project_groups`
  - Columns: `id uuid pk`, `household_id uuid`, `name text not null`, `description text`, `tags text[]`, audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`).
  - Trigger helpers populate audit fields and a consistency trigger on `projects` enforces matching `household_id` when linking a project to a group.
  - RLS: household members can select/insert/update/delete groups scoped to their household.
- View `project_metrics`
  - Aggregates open/done todos, linked document count, and exposes `actual_cost_cached` for each project (backed by RLS on the underlying tables).

- View `project_group_metrics`
  - Rolls up per-group counts (projects, tasks, documents) and compares planned vs. actual budgets to support dashboards.

- Storage bucket `files`
  - Owner-only access enforced by policies that restrict CRUD to paths prefixed with the uploader’s `auth.uid()` and cross-check household membership through `documents` → `interactions`.
  - UI stores files at `userId/interactionId/<uuid>_filename` to stay within policy constraints.

- Legacy template tables: `todo_list` (from the SaaS starter) still exists with owner-only policies and is used by `/app/table`. It is not part of the House domain.

- Functions & helpers
- `create_interaction_with_zones(p_household_id, p_subject, p_zone_ids uuid[], p_content text default '', p_type text default 'note', p_status text default null, p_occurred_at timestamptz default null, p_tag_ids uuid[] default null, p_contact_ids uuid[] default null, p_structure_ids uuid[] default null, p_project_id uuid default null)`: inserts an interaction with zone links atomically after validating membership/ownership and can optionally attach the interaction to a project; returns the new interaction UUID. Used by the “new interaction” form.
  - `create_household_with_owner(p_name text)`: `SECURITY DEFINER` RPC that checks `auth.uid()`, trims/validates the name, inserts the household, and enrolls the caller as `owner` atomically. Called from `/api/households`.

## 6) App Architecture (Next.js)
- Root layout (`nextjs/src/app/layout.tsx`) wraps pages with the i18n provider, cookie banner, and analytics integration. Theme/product name still come from SaaS template environment variables.
- Global context (`GlobalContext`) loads the current user, their households, and manages the selected household (stored in `localStorage`).
- Routes under `/auth/*` provide login/registration flows plus the `/auth/2fa` challenge screen; `/legal/*` hosts markdown legal pages.
- `/app` dashboard aggregates recent entries and zone counts for the selected household, surfaces quick actions (new entry, manage zones, user settings, households), and respects the locale stored on the user profile.
- Interactions UI (`/app/interactions`): list view limited to recent interactions with attachment counts, subject/type/status metadata, and zone context. Detail view loads zones and previews attachments (image/pdf) via signed URLs; any household member can delete an interaction per RLS, while document deletion in the UI is limited to the uploader to satisfy storage owner-only policies. `/app/interactions/new` captures interactions with zone selection, metadata (subject/type/status/date/tags), inline zone creation, and attachment upload (client uploads to storage then inserts rows into `documents`).
- Projects UI (`/app/projects` and `/app/projects/[id]`): list and filter projects by status/dates/tags, show budget and activity rollups, and expose quick actions to create tasks, notes, documents, or expenses pre-linked to the project. Detail pages provide a timeline, dedicated tabs (tasks/documents/expenses) backed by `project_metrics`, and let members relink existing interactions to the project.
- Zones UI (`/app/zones`): manage zones, including optional parent assignment, free-form notes, surface area capture, color selection for first-level children, and per-household stats. Any household member can update or delete a zone; descendants automatically display lighter shades of their parent color and the UI exposes confirmations rather than ownership blockers.
- Zone detail cards now include a photo gallery so members can visualize each zone. Users may upload new photo documents or link existing ones from the household library; previews use signed URLs from Supabase storage.
- User settings (`/app/user-settings`): change locale, view account metadata, update password, and enrol/manage TOTP MFA devices via `MFASetup`.
- Household flows: `/app/households/new` posts to `/api/households` to create a household plus membership via the security-definer RPC. `/app/households` currently just links to creation.
- Template demos: `/app/storage` (personal file bucket) and `/app/table` (todo list) still exist from the upstream template and operate on template schema. They are unrelated to the House domain and should be hidden or removed before launch.
- i18n: `I18nProvider` wraps the tree; dictionaries in `lib/i18n/dictionaries` include keys for dashboard, entries, zones, storage, etc. Locale persists in `localStorage`.

## 7) API & Edge Functions
- `POST /api/households`: server action that authenticates the caller, then uses the SSR client (anon key) to execute the `create_household_with_owner` security-definer RPC, which inserts the household and enrols the requester as owner.
- `POST /api/internal/process-entry-files`: service-role pipeline kick-off; requires the `x-internal-task-token` header matching `INTERNAL_TASK_TOKEN`, runs `processEntryFiles` to extract attachment text and refresh `documents.ocr_text` / `interactions.enriched_text`.
- `GET /api/auth/callback`: template Supabase auth callback route; untouched.
- No dedicated API routes for entries/zones/files—client components interact directly with Supabase (RLS-enforced).
- No edge functions or background workers yet. OCR, enrichment, and search remain future work.

## 8) Conventions & Guidelines
- RLS-first: every new table must ship with RLS and policies mirroring membership rules. Prefer explicit policies over broad ones.
- Membership-driven access: when authoring SQL, join to `household_members` and use `auth.uid()` checks. Reuse the `create_interaction_with_zones` RPC for atomic interaction creation.
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
- OCR & enrichment: implement file processing pipeline (edge function or background worker) to populate `documents.ocr_text` / `interactions.enriched_text`.
- Interaction maintenance: add edit/update flows (including zone reassignment and attachment management) and consider pagination beyond the latest 50 interactions.
- Household management: surface household list, invitations, role management, and ability to switch default household via the UI.
- Schema/types hygiene: regenerate `Database` types, remove unused template tables/routes (`todo_list`, `/app/table`, `/app/storage`) once House features replace them.
- Quality & operations: extend automated testing (more Playwright coverage, unit/integration suites), add CI, production-ready logging/monitoring, and update `README.md` to describe House instead of the upstream SaaS template.

## 11) Risks & Constraints
- Do not modify the Supabase `auth` schema. Reference `auth.users` but avoid schema changes there.
- Service-role usage (`createServerAdminClient`) must remain limited to trusted server contexts; never expose the service key to the browser.
- Storage security depends on file paths prefixed with `auth.uid()`; ensure any new uploads follow the same convention.
- Zones, entries, and files can now be managed (update/delete) by any household member; owners inherit full control through membership. Update flows still need UI work but RLS is ready.
- `nextjs/src/lib/types.ts` is outdated; relying on it for new queries can cause runtime/type mismatches until regenerated.
- Template routes (storage, todo) are still exposed. Disable or guard them before production to prevent confusing or insecure flows.

## 12) Helpful File Pointers
- Interactions list: `nextjs/src/app/app/interactions/page.tsx`
- Interaction creation: `nextjs/src/app/app/interactions/new/page.tsx`
- Interaction detail + deletion: `nextjs/src/app/app/interactions/[id]/page.tsx`
- Zones management: `nextjs/src/app/app/zones/page.tsx`
- User settings + MFA enrolment: `nextjs/src/app/app/user-settings/page.tsx`, `nextjs/src/components/MFASetup.tsx`
- MFA challenge screen: `nextjs/src/app/auth/2fa/page.tsx`, `nextjs/src/components/MFAVerification.tsx`
- Household creation API: `nextjs/src/app/api/households/route.ts`
- Supabase browser client wrapper: `nextjs/src/lib/supabase/client.ts`
- Global household context: `nextjs/src/lib/context/GlobalContext.tsx`
- Documents schema/policies refactor: `supabase/migrations/20251016120000_refactor_entries_to_interactions.sql`
- Interaction creation RPC: `supabase/migrations/20251016120000_refactor_entries_to_interactions.sql`
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

## 15) Testing & QA
- End-to-end tests use Playwright and live under `nextjs/tests/e2e`. Coverage includes auth redirects, zone creation/rename/delete (with notes and surface fields), interaction list/new/detail flows with attachment upload & cleanup, cross-member interaction deletion, and validation errors—all seeded via Supabase service-role helpers.
- Install Playwright browsers with `cd nextjs && yarn playwright:install` (once per machine). Ensure `.env.local` exposes Supabase URL, anon key, and `PRIVATE_SUPABASE_SERVICE_KEY` for the test harness.
- Run the suite via `yarn test:e2e` from the repo root or `cd nextjs && yarn test:e2e`. Set `PLAYWRIGHT_SKIP_WEB_SERVER=1` if you want to manage the Next.js server manually.
- Tests seed temporary users/households via the service key and clean them up after each run; use isolated Supabase instances or reset your local DB if a run is interrupted.
- Playwright automatically loads environment variables from `.env.test.local`, `.env.local`, `.env`, and `supabase/.env`. Ensure these files expose Supabase URL, anon, and service-role keys for deterministic runs.

## 16) Architecture & Folder Patterns
- **Feature-first slices**: Domain logic (contacts, interactions, projects, zones, photos, etc.) lives under `nextjs/src/features/<domain>` with consistent sub-folders (`components/`, `hooks/`, `lib/`, `utils/`, `types.ts`). Components are imported via path aliases like `@interactions/components/InteractionForm` to keep route files thin.
- **Route entrypoints**: `nextjs/src/app` is limited to App Router files (`layout.tsx`, `page.tsx`, route handlers). Files under `/app/app/*` load data via hooks/contexts and delegate rendering to feature components. Favor server components unless the page needs browser APIs (`"use client"`).
- **Shared UI + layout**: Global UI primitives sit in `nextjs/src/components/ui` (shadcn) and layout shell pieces in `nextjs/src/components/layout`. Reuse these before creating new wrappers so typography/theme stays consistent.
- **Cross-cutting libraries**: `nextjs/src/lib` houses Supabase clients (`supabase/`), configuration, contexts (e.g., `GlobalContext`), utilities, and i18n (`i18n/`, dictionaries). Any code that is not domain-specific but reused across features should live here.
- **Backend & schema**: Supabase SQL lives in `supabase/migrations` with timestamped filenames. Keep RLS policies close to their tables and document new RPCs/functions. Service-role utilities/tests live under `supabase/tests`.
- **Testing artifacts**: Playwright specs live in `nextjs/tests/e2e`, while failing-run artifacts are stored under `nextjs/test-results`. Keep heavy fixtures (videos, traces) out of feature folders.

## 17) Organizing Requests & Changes by Layer
When scoping a new request or PR, keep changes separated so reviewers can trace intent quickly:
1. **Data & RLS**: Document whether Supabase schema/migrations or storage policies must change. Include table, trigger, and policy impacts plus any need to regenerate `Database` types.
2. **Server boundary**: Clarify updates to `app/api/*` route handlers, server components, or Supabase client helpers (`createSSRClient`, `createServerAdminClient`). Note required headers/secrets.
3. **Feature module**: Identify the owning domain folder in `nextjs/src/features/<domain>` and add/adjust code inside the appropriate sub-folder (`components`, `hooks`, `lib`, etc.) to keep logic reusable.
4. **Route surface & navigation**: Explain how `nextjs/src/app/...` pages/layouts should consume the feature code, including loading states, error handling, and any `AppPageLayout`/`GlobalContext` needs.
5. **Shared resources**: Call out required updates to `nextjs/src/components` (shared UI), i18n dictionaries (`lib/i18n/dictionaries`), styles, and automated tests (`nextjs/tests/e2e`). Mention documentation touch points (README, AGENTS, BACKLOG) if behavior changes.

Following this checklist keeps responsibilities separated (schema ↔ server ↔ feature ↔ route ↔ shared assets) and mirrors the existing project structure, which in turn makes future diffs smaller and safer.
