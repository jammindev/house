# AGENTS.md — Project Context for AI Assistants

This document gives AI and contributors a compact, high-signal overview of the repository: goals, architecture, schema, routes, conventions, and current gaps. Use it to understand the project quickly and to propose changes safely.

If you are an AI planning to change code, also read AI_UPDATE_WORKFLOW.md for the step-by-step update process and checklists.

## 1) Product Summary
- Name: House
- Purpose: Centralize household knowledge (chronological interactions with attachments, tagging, and context). Current build supports multi-tenant households, interaction capture, attachments, and zone management. Full-text search, OCR, renovation projects, budgeting, reminders, and maintenance dashboards are still future phases.
- Multi-tenancy: Users belong to one or more households via `household_members`; all content is scoped by `household_id` and protected with RLS.

## 2) Repository Layout — MONOREPO STRUCTURE

- Root scripts: `package.json` orchestrates the monorepo with Yarn Workspaces v4.10.3 (`dev|build|start` → workspace commands, `db:migrate`, `db:reset`, `db:new`, `test:e2e`).
- **Monorepo structure**:
  - `apps/web/` (Next.js 15 App Router, React 19, Tailwind, shadcn/ui, custom i18n) - previously `nextjs/`
  - `apps/mobile/` (React Native + Expo, React Navigation, shared hooks)
  - `packages/shared/` (TypeScript package with reusable hooks, types, and utilities)
- Frontend web app: `apps/web/` (Next.js 15 App Router, React 19, Tailwind, shadcn/ui, custom i18n).
  - Auth: `apps/web/src/app/auth/*`
  - Dashboard + product: `apps/web/src/app/app/*` (households, zones, interactions, storage demo, todo demo).
  - Interactions flow: `apps/web/src/app/app/interactions/{page.tsx,new/[id]}`.
  - API routes: `apps/web/src/app/api/households/route.ts` and the template `api/auth/callback`.
  - Supabase helpers: `apps/web/src/lib/supabase/{client,server,serverAdminClient,unified}.ts`.
  - Global household context: `apps/web/src/lib/context/GlobalContext.tsx`.
  - i18n dictionaries: `apps/web/src/lib/i18n/dictionaries/{en,fr}.json`.
- Mobile app: `apps/mobile/` (React Native + Expo, React Navigation, shared business logic).
  - Entry point: `apps/mobile/App.tsx` with navigation setup
  - Screens: `apps/mobile/src/screens/` with bottom tab navigation
  - Shared hooks: Uses `@house/shared` package for business logic consistency
  - Configuration: `apps/mobile/metro.config.js` configured for monorepo paths
- Shared package: `packages/shared/` (TypeScript compilation to dist/, reusable across web and mobile).
  - Hooks: `packages/shared/src/hooks/` (e.g., useContacts for data fetching)
  - Types: `packages/shared/src/types.ts` (shared TypeScript definitions)
  - Utils: `packages/shared/src/utils/` (common utility functions)
- Supabase project: `supabase/`
  - Migrations define households, members, zones (with parent/creator), interactions, interaction_zones, documents, RPCs, and storage policies. Legacy template artifacts (`todo_list`) remain.
  - `supabase/config.toml` configures local dev, bucket `files`, and auth settings.
- Docs & meta: `AGENTS.md` (this file), `AI_UPDATE_WORKFLOW.md`, `README.md`, `MONOREPO_GUIDE.md`, `WORKSPACE_COMMANDS.md`.
- CI: none; `.github/ISSUE_TEMPLATE` only.

## 3) Tech Stack — UPDATED FOR MONOREPO
- **Monorepo**: Yarn Workspaces v4.10.3 with apps/ and packages/ structure
- Frontend web: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Lucide icons, custom i18n provider.
- Frontend mobile: React Native + Expo, React Navigation, Metro bundler configured for monorepo.
- Shared logic: TypeScript package (`@house/shared`) with reusable hooks, types, and utilities.
- Backend: Supabase (Postgres 17, RLS policies, Storage buckets, Auth).
- Tooling: TypeScript 5, ESLint 9, PostCSS, Yarn Workspaces. Supabase CLI for migrations/RPCs.
- Deployment: Vercel with corepack for modern Yarn support, `file:` dependencies for workspace compatibility.

## 4) Environment & Secrets — UPDATED FOR MONOREPO
- Copy `apps/web/.env.template` → `apps/web/.env.local` and provide:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `PRIVATE_SUPABASE_SERVICE_KEY`
- Copy `apps/mobile/.env.template` → `apps/mobile/.env.local` and provide:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Template variables (`NEXT_PUBLIC_PRODUCTNAME`, `NEXT_PUBLIC_THEME`, billing tier settings, etc.) are still present; adjust or remove them for House branding before production.
- Never commit `.env.local` files.
- Supabase linking workflow: `npx supabase login`, `npx supabase link`, `npx supabase config push`, `npx supabase migrations up --linked`.

## 5) Workspace Commands & Dependencies — NEW SECTION
### Root Commands (run from /house)
```bash
# Development
yarn dev                    # Start web dev server
yarn dev:mobile            # Start mobile dev server

# Building
yarn build                 # Build shared + web (production)
yarn build:shared          # Build shared package only
yarn build:web             # Build web with shared dependency

# Testing & Quality
yarn test                  # Run all tests
yarn test:e2e              # Run end-to-end tests (web)
yarn lint                  # Lint all workspaces
yarn type-check            # Type check all workspaces

# Database
yarn db:migrate            # Run Supabase migrations
yarn db:reset              # Reset Supabase database
yarn db:new <name>         # Create new migration

# Maintenance
yarn clean                 # Clean build artifacts
```

### Shared Package Resolution
- Both apps depend on `@house/shared` via `"@house/shared": "file:../../packages/shared"`
- The shared package compiles TypeScript to `packages/shared/dist/`
- During development, use `yarn workspace @house/shared dev` (tsc --watch) to auto-rebuild
- Apps import compiled JavaScript from the shared package at runtime
- TypeScript path mapping in `tsconfig.json` points to source for editor support

### Metro Configuration (Mobile)
- `apps/mobile/metro.config.js` maps `@house/shared` to `packages/shared/dist`
- Adds shared package to `watchFolders` for hot reload on changes
- Configured for monorepo structure with proper Node modules resolution

### Next.js Configuration (Web)
- `apps/web/next.config.ts` configured for Supabase images
- Uses compiled shared package from `node_modules/@house/shared`
- Build process: shared package → web application

### Vercel Deployment
- `vercel.json` configured with:
  - `installCommand: "corepack enable && yarn install"`
  - `buildCommand: "corepack enable && yarn build"`
  - `outputDirectory: "apps/web/.next"`
- Uses `file:` dependencies for Yarn v1 compatibility
- Enables modern Yarn with corepack for workspace support

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
- Root layout (`apps/web/src/app/layout.tsx`) wraps pages with the i18n provider, cookie banner, and analytics integration. Theme/product name still come from SaaS template environment variables.
- Global context (`GlobalContext`) loads the current user, their households, and manages the selected household (stored in `localStorage`).
- Routes under `/auth/*` provide login/registration flows plus the `/auth/2fa` challenge screen; `/legal/*` hosts markdown legal pages.
- `/app` dashboard aggregates recent entries and zone counts for the selected household, surfaces quick actions (new entry, manage zones, user settings, households), and respects the locale stored on the user profile.
- Interactions UI (`/app/interactions`): list view limited to recent interactions with attachment counts, subject/type/status metadata, and zone context. Detail view loads zones and previews attachments (image/pdf) via signed URLs; any household member can delete an interaction per RLS, while document deletion in the UI is limited to the uploader to satisfy storage owner-only policies. `/app/interactions/new` captures interactions with zone selection, metadata (subject/type/status/date/tags), inline zone creation, and attachment upload (client uploads to storage then inserts rows into `documents`).
- Tasks board (`/app/tasks`): kanban-style drag-and-drop board that surfaces `todo` interactions grouped by status (backlog, pending, in progress, done, archived) and lets members update statuses directly.
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

## 9) How to Run Locally — UPDATED FOR MONOREPO
1. **Supabase setup (first time per machine/project)**
   ```bash
   npx supabase login
   npx supabase link
   npx supabase config push
   npx supabase migrations up --linked
   ```

2. **Monorepo setup**
   ```bash
   # Install all workspace dependencies
   yarn install
   
   # Build shared package (required before starting apps)
   yarn build:shared
   ```

3. **Environment configuration**
   ```bash
   # Web app
   cp apps/web/.env.template apps/web/.env.local
   # Edit apps/web/.env.local with Supabase keys + branding vars
   
   # Mobile app
   cp apps/mobile/.env.template apps/mobile/.env.local
   # Edit apps/mobile/.env.local with Supabase keys
   ```

4. **Development servers**
   ```bash
   # Web app (terminal 1)
   yarn dev  # → http://localhost:3000 or 3001
   
   # Mobile app (terminal 2)
   yarn dev:mobile  # → Expo QR code for device testing
   ```

5. **Development workflow with shared code**
   ```bash
   # Auto-rebuild shared package on changes (terminal 3)
   yarn workspace @house/shared dev
   
   # Or manually rebuild after changes
   yarn build:shared
   ```

## 10) Roadmap / TODOs (High Priority) — UPDATED
- **Monorepo stabilization**: Complete mobile feature parity, ensure all shared hooks work across platforms
- **Search**: add `search_vector`, trigger maintenance, and a `/search` UI for entries.
- **OCR & enrichment**: implement file processing pipeline (edge function or background worker) to populate `documents.ocr_text` / `interactions.enriched_text`.
- **Interaction maintenance**: add edit/update flows (including zone reassignment and attachment management) and consider pagination beyond the latest 50 interactions.
- **Household management**: surface household list, invitations, role management, and ability to switch default household via the UI.
- **Schema/types hygiene**: regenerate `Database` types, remove unused template tables/routes (`todo_list`, `/app/table`, `/app/storage`) once House features replace them.
- **Quality & operations**: extend automated testing (more Playwright coverage, unit/integration suites), add CI, production-ready logging/monitoring, and update `README.md` to describe House instead of the upstream SaaS template.
- **Mobile development**: Complete mobile app features, offline-first capabilities, camera integration

## 11) Risks & Constraints
- Do not modify the Supabase `auth` schema. Reference `auth.users` but avoid schema changes there.
- Service-role usage (`createServerAdminClient`) must remain limited to trusted server contexts; never expose the service key to the browser.
- Storage security depends on file paths prefixed with `auth.uid()`; ensure any new uploads follow the same convention.
- Zones, entries, and files can now be managed (update/delete) by any household member; owners inherit full control through membership. Update flows still need UI work but RLS is ready.
- `nextjs/src/lib/types.ts` is outdated; relying on it for new queries can cause runtime/type mismatches until regenerated.
- Template routes (storage, todo) are still exposed. Disable or guard them before production to prevent confusing or insecure flows.

## 12) Helpful File Pointers — UPDATED FOR MONOREPO
- **Monorepo configuration**: 
  - Root workspace: `package.json`, `.yarnrc.yml`, `tsconfig.json`
  - Shared package: `packages/shared/package.json`, `packages/shared/src/index.ts`
  - Web app: `apps/web/package.json`, `apps/web/next.config.ts`
  - Mobile app: `apps/mobile/package.json`, `apps/mobile/metro.config.js`
  - Deployment: `vercel.json`
- **Web application routes**:
  - Interactions list: `apps/web/src/app/app/interactions/page.tsx`
  - Interaction creation: `apps/web/src/app/app/interactions/new/page.tsx`
  - Interaction detail + deletion: `apps/web/src/app/app/interactions/[id]/page.tsx`
  - Zones management: `apps/web/src/app/app/zones/page.tsx`
  - User settings + MFA enrolment: `apps/web/src/app/app/user-settings/page.tsx`, `apps/web/src/components/MFASetup.tsx`
  - MFA challenge screen: `apps/web/src/app/auth/2fa/page.tsx`, `apps/web/src/components/MFAVerification.tsx`
- **API and context**:
  - Household creation API: `apps/web/src/app/api/households/route.ts`
  - Supabase browser client wrapper: `apps/web/src/lib/supabase/client.ts`
  - Global household context: `apps/web/src/lib/context/GlobalContext.tsx`
- **Mobile application**:
  - Entry point: `apps/mobile/App.tsx`
  - Screens: `apps/mobile/src/screens/`
  - Navigation: `apps/mobile/src/navigation/`
- **Shared code**:
  - Hooks: `packages/shared/src/hooks/`
  - Types: `packages/shared/src/types.ts`
  - Utilities: `packages/shared/src/utils/`
- **Database and infrastructure**:
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

## 16) Architecture & Folder Patterns — UPDATED FOR MONOREPO
- **Monorepo architecture**: Feature-first with shared logic extracted to `packages/shared`
- **Web app architecture**: Domain logic lives under `apps/web/src/features/<domain>` with consistent sub-folders (`components/`, `hooks/`, `lib/`, `utils/`, `types.ts`). Components are imported via path aliases like `@interactions/components/InteractionForm` to keep route files thin.
- **Mobile app architecture**: Screen-based with `apps/mobile/src/screens/` containing React Native screens, shared business logic via `@house/shared` imports.
- **Shared package architecture**: `packages/shared/src/` contains:
  - `hooks/` - Reusable React hooks (useContacts, useSupabase, useInteractions)
  - `types.ts` - Shared TypeScript definitions
  - `utils/` - Common utility functions
  - `index.ts` - Package exports
- **Route entrypoints**: `apps/web/src/app` is limited to App Router files (`layout.tsx`, `page.tsx`, route handlers). Files under `/app/app/*` load data via hooks/contexts and delegate rendering to feature components. Favor server components unless the page needs browser APIs (`"use client"`).
- **Shared UI + layout**: Global UI primitives sit in `apps/web/src/components/ui` (shadcn) and layout shell pieces in `apps/web/src/components/layout`. Reuse these before creating new wrappers so typography/theme stays consistent.
- **Cross-cutting libraries**: `apps/web/src/lib` houses Supabase clients (`supabase/`), configuration, contexts (e.g., `GlobalContext`), utilities, and i18n (`i18n/`, dictionaries). Any code that is not domain-specific but reused across features should live here.
- **Backend & schema**: Supabase SQL lives in `supabase/migrations` with timestamped filenames. Keep RLS policies close to their tables and document new RPCs/functions. Service-role utilities/tests live under `supabase/tests`.
- **Testing artifacts**: Playwright specs live in `apps/web/tests/e2e`, while failing-run artifacts are stored under `apps/web/test-results`. Keep heavy fixtures (videos, traces) out of feature folders.

## 17) Shared Package Development Workflow — NEW SECTION
### Code Sharing Patterns
- **Hooks**: Business logic hooks go in `packages/shared/src/hooks/` (e.g., `useContacts`, `useInteractions`)
- **Types**: Shared TypeScript definitions in `packages/shared/src/types.ts`
- **Utilities**: Common functions in `packages/shared/src/utils/`
- **Supabase clients**: Shared Supabase configuration and client creation

### Development Workflow
1. **Build shared package first**: `yarn build:shared` (compiles TypeScript to `dist/`)
2. **Watch mode during development**: `yarn workspace @house/shared dev` (runs `tsc --watch`)
3. **Import in apps**: `import { useContacts } from '@house/shared'`
4. **TypeScript resolution**: Path mapping in `tsconfig.json` points to source for editor support

### Adding New Shared Code
1. Create files in `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Rebuild: `yarn build:shared`
4. Import in apps: `import { newHook } from '@house/shared'`

### Metro Configuration (Mobile)
- `apps/mobile/metro.config.js` maps `@house/shared` to `packages/shared/dist`
- Adds shared package to `watchFolders` for hot reload
- Uses compiled JavaScript from `dist/`, not TypeScript source

### Next.js Configuration (Web)
- Uses `file:` dependency pointing to `packages/shared`
- Imports compiled JavaScript from shared package
- Build process ensures shared package is built first

## 18) Deployment & CI/CD — NEW SECTION
### Vercel Configuration
- **Root Directory**: `./` (monorepo root, not `apps/web`)
- **Framework**: Other (custom configuration)
- **Build Command**: `corepack enable && yarn build`
- **Install Command**: `corepack enable && yarn install`
- **Output Directory**: `apps/web/.next`
- **Node.js Version**: 20.x (specified in `.nvmrc`)

### Vercel Environment Variables
Required in Vercel Dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PRIVATE_SUPABASE_SERVICE_KEY=your-service-role-key
```

### Build Process
1. **Install**: Vercel runs `corepack enable && yarn install` (enables Yarn v4)
2. **Workspace resolution**: `file:` dependencies resolve to local packages
3. **Build**: `yarn build` runs `yarn build:shared && yarn workspace @house/web build`
4. **Output**: Next.js build artifacts in `apps/web/.next`

### Mobile Deployment (Expo)
- Development: `yarn dev:mobile` → Expo QR code
- Production builds: `expo build:android` / `expo build:ios`
- App Store/Play Store submission via Expo or EAS

### Deployment Troubleshooting
- **Yarn version issues**: Ensure `corepack enable` is in install/build commands
- **Workspace resolution**: Use `file:` dependencies instead of `workspace:*` for Vercel compatibility
- **Build order**: Shared package must build before web app (handled by root `yarn build`)

## 19) Documentation Hierarchy — FOR AI REFERENCE
### Primary AI Documentation (READ FIRST)
- **`AGENTS.md`** (this file): Complete project overview, architecture, conventions
- **`AI_UPDATE_WORKFLOW.md`**: Step-by-step process for making changes
- **`WORKSPACE_COMMANDS.md`**: All available monorepo commands
- **`MONOREPO_GUIDE.md`**: Detailed monorepo setup and patterns

### Secondary Documentation
- **`STRUCTURE.md`**: Detailed folder structure and patterns
- **`MIGRATION_GUIDE.md`**: Migration from single app to monorepo
- **`README.md`**: User-facing project overview and setup
- **`supabase/RLS_OVERVIEW.md`**: Database security model
- **`apps/web/README.md`**: Web app specific documentation

### Legacy/Template Documentation (IGNORE OR UPDATE)
- **`instructions.md`**: Outdated single-app context (should be updated)
- **`BACKLOG.md`**: Feature planning (may be outdated)
- **`AUDIT.md`**: Project audit (may need updating)

### AI Reading Priority
1. Read `AGENTS.md` (this file) first for complete context
2. Reference `AI_UPDATE_WORKFLOW.md` before making changes
3. Use `WORKSPACE_COMMANDS.md` for specific commands
4. Consult other files as needed for specific domains

## 20) Organizing Requests & Changes by Layer
When scoping a new request or PR, keep changes separated so reviewers can trace intent quickly:
1. **Data & RLS**: Document whether Supabase schema/migrations or storage policies must change. Include table, trigger, and policy impacts plus any need to regenerate `Database` types.
2. **Shared logic**: Identify any business logic that should be extracted to `packages/shared` for use by both web and mobile apps. Consider hooks, types, and utilities.
3. **Server boundary**: Clarify updates to `apps/web/src/app/api/*` route handlers, server components, or Supabase client helpers (`createSSRClient`, `createServerAdminClient`). Note required headers/secrets.
4. **Feature modules**: Identify the owning domain folder in `apps/web/src/features/<domain>` and add/adjust code inside the appropriate sub-folder (`components`, `hooks`, `lib`, etc.) to keep logic reusable.
5. **Mobile implementation**: Consider how features should be implemented in `apps/mobile/src/screens/` and whether shared hooks from `@house/shared` can be reused.
6. **Route surface & navigation**: Explain how `apps/web/src/app/...` pages/layouts should consume the feature code, including loading states, error handling, and any `AppPageLayout`/`GlobalContext` needs.
7. **Shared resources**: Call out required updates to `apps/web/src/components` (shared UI), i18n dictionaries (`lib/i18n/dictionaries`), styles, and automated tests (`apps/web/tests/e2e`). Mention documentation touch points (README, AGENTS, BACKLOG) if behavior changes.

Following this checklist keeps responsibilities separated (schema ↔ shared ↔ server ↔ feature ↔ mobile ↔ route ↔ shared assets) and mirrors the existing project structure, which in turn makes future diffs smaller and safer.
When scoping a new request or PR, keep changes separated so reviewers can trace intent quickly:
1. **Data & RLS**: Document whether Supabase schema/migrations or storage policies must change. Include table, trigger, and policy impacts plus any need to regenerate `Database` types.
2. **Server boundary**: Clarify updates to `app/api/*` route handlers, server components, or Supabase client helpers (`createSSRClient`, `createServerAdminClient`). Note required headers/secrets.
3. **Feature module**: Identify the owning domain folder in `nextjs/src/features/<domain>` and add/adjust code inside the appropriate sub-folder (`components`, `hooks`, `lib`, etc.) to keep logic reusable.
4. **Route surface & navigation**: Explain how `nextjs/src/app/...` pages/layouts should consume the feature code, including loading states, error handling, and any `AppPageLayout`/`GlobalContext` needs.
5. **Shared resources**: Call out required updates to `nextjs/src/components` (shared UI), i18n dictionaries (`lib/i18n/dictionaries`), styles, and automated tests (`nextjs/tests/e2e`). Mention documentation touch points (README, AGENTS, BACKLOG) if behavior changes.

Following this checklist keeps responsibilities separated (schema ↔ server ↔ feature ↔ route ↔ shared assets) and mirrors the existing project structure, which in turn makes future diffs smaller and safer.
