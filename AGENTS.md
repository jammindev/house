# AGENTS.md — Project Context for AI Assistants

This document gives AI and contributors a compact, high-signal overview of the repository: goals, architecture, schema, routes, conventions, and current gaps. Use it to understand the project quickly and to propose changes safely.

If you are an AI planning to change code, also read AI_UPDATE_WORKFLOW.md for the step‑by‑step update process and checklists.

## 1) Product Summary
- Name: House
- Purpose: Centralize household knowledge. MVP is a journal of entries with attachments, OCR, and full‑text search. Phase 2 adds renovation projects, budget dashboard, reminders, and maintenance.
- Scope focus: Multi-tenant at the household level via RLS; each user belongs to one or more households through `household_members`.

## 2) Repository Layout
- Root scripts: `package.json` orchestrates Next.js app and Supabase CLI
  - `dev|build|start` → `cd nextjs && yarn ...`
  - `db:migrate` → `supabase migrations up --linked`
  - `db:reset` → `supabase db reset --linked`
  - `db:new` → `supabase migration new`
  - `tree` → exports file tree to `repo_tree.txt`
- Frontend: `nextjs/` (Next.js 15, React 19, Tailwind, shadcn/ui)
- Backend (DB): `supabase/` (Postgres migrations + config)
- Docs/notes: `instructions.md` (functional intent and roadmap)

Key files and dirs:
- `nextjs/src/app/*` — App Router routes (auth, legal, demo app screens)
- `nextjs/src/lib/supabase/*` — Supabase client/server/SSR helpers + middleware
- `supabase/migrations/*_create_*.sql` — RLS-first schema for households, zones, entries, entry_zones
- `supabase/config.toml` — Supabase project config

## 3) Tech Stack
- Frontend: Next.js 15 (App Router), React 19, Tailwind, shadcn/ui, Lucide icons
- Backend: Supabase (Postgres, RLS, Storage), Supabase Auth
- Tooling: TypeScript, ESLint, PostCSS, Yarn; Supabase CLI for migrations

## 4) Environment & Secrets
- Copy `nextjs/.env.template` → `nextjs/.env.local` and fill:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `PRIVATE_SUPABASE_SERVICE_KEY`
- Do not commit `.env.local`.
- Supabase linking: `npx supabase login`, `npx supabase link` (uses DB password), then `npx supabase config push` and `npx supabase migrations up --linked`.

## 5) Database Model (RLS-first)
All domain tables have RLS enabled. Membership drives access.

Tables
- households
  - `id uuid pk default gen_random_uuid()`
  - `name text not null`
  - `created_at timestamptz default now()`
  - RLS: Enabled. Select policy is defined after `household_members` creation (see below).

- household_members
  - `household_id uuid fk → households(id) on delete cascade`
  - `user_id uuid fk → auth.users(id) on delete cascade`
  - `role text default 'member'`
  - Primary key `(household_id, user_id)`
  - RLS policies:
    - Select: user can read own memberships (`user_id = auth.uid()`)
    - Insert: user can join (`user_id = auth.uid()`)
  - After creation, policy on `households` allows select where a membership exists for `auth.uid()`.

- zones
  - `id uuid pk default gen_random_uuid()`
  - `household_id uuid fk → households(id) on delete cascade`
  - `name text not null`
  - `created_at timestamptz default now()`
  - RLS policy: members of the zone’s household can perform all actions.

- entries
  - `id uuid pk default gen_random_uuid()`
  - `household_id uuid not null fk → households(id) on delete cascade`
  - `raw_text text not null`
  - `enriched_text text`
  - `metadata jsonb default '{}'::jsonb`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
  - `created_by uuid fk → auth.users(id) not null`
  - `updated_by uuid fk → auth.users(id)`
  - Trigger `update_entry_metadata` sets `updated_at` and `updated_by = auth.uid()` on update
  - RLS policies: household members can select/insert/update/delete when membership to the entry’s `household_id` exists.

- entry_zones (N:N entries ↔ zones)
  - `entry_id uuid fk → entries(id) on delete cascade`
  - `zone_id uuid fk → zones(id) on delete cascade`
  - PK `(entry_id, zone_id)`
  - RLS policies: members of the entry’s household can manage; checks are implemented by joining `entries` then resolving to membership.

Planned tables
- entry_files (pending)
  - `entry_id`, `storage_path`, `mime_type`, `ocr_text`, `metadata jsonb`, audit fields
  - Storage bucket + RLS to restrict files to household members

Full‑text search plan
- Add `search_vector tsvector` on entries (raw + enriched + tags from metadata)
- Maintain via trigger; GIN index for fast search

## 6) App Architecture (Next.js)
- App Router under `nextjs/src/app`
  - Auth flow: `auth/login`, `auth/register`, `auth/verify-email`, `auth/forgot-password`, `auth/reset-password`, `auth/2fa`
  - Legal: `legal/*` with markdown documents
  - Demo app screens: `app/*` (storage/table/user-settings) from the base template
- Layout & UI
  - Tailwind + shadcn patterns
  - `src/components/*` includes UI primitives and SaaS template features (cookies, MFA, pricing)
- Supabase integration
  - `src/lib/supabase/client.ts` — browser client
  - `src/lib/supabase/server.ts` — server client in RSC
  - `src/lib/supabase/serverAdminClient.ts` — service-role where appropriate (use carefully)
  - `src/lib/supabase/unified.ts` — helper consolidation
  - `src/lib/supabase/middleware.ts` — auth/session middleware helpers
- Middleware
  - `src/middleware.ts` present (template-level). Extend to protect app routes if needed.

Missing UI (MVP)
- Entries pages: `/entries`, `/entries/new`, `/entries/[id]`
  - CRUD wired to RLS policies
  - Zone assignment via `entry_zones`
  - Attachment upload (later: OCR, enrichment, search)

## 7) API & Edge Functions
- Current API routes: `src/app/api/auth/callback/route.ts` (template callback)
- Planned: Edge Function for OCR pipeline
  - Upload → OCR → store `ocr_text` → optional AI enrichment → update `entries`

## 8) Conventions & Guidelines
- DB
  - Prefer explicit SQL migrations; keep RLS policies alongside tables
  - Use `auth.uid()` checks; avoid bypassing RLS except in controlled server contexts
  - When adding tables, define RLS and basic indexes in the same migration
- App
  - Server Components by default; client components where interaction is needed
  - Use Supabase server client in RSC actions; avoid leaking service keys to the browser
  - Keep types in `src/lib/types.ts`; reusable utilities in `src/lib/utils.ts`
- Naming
  - Paths and identifiers in `snake_case` for DB; `camelCase`/`PascalCase` in TS

## 9) How to Run Locally
1) Supabase (once per machine/project)
- `npx supabase login`
- `npx supabase link` (select project; requires DB password)
- `npx supabase config push`
- `npx supabase migrations up --linked`

2) Frontend
- `cd nextjs && yarn` (install dependencies)
- Copy `.env.template` → `.env.local`; fill envs
- `yarn dev` then open `http://localhost:3000`

## 10) Roadmap / TODOs (High Priority)
- Entries UI
  - List, create, read, update, delete
  - Zone linking UX; inline zone creation
- Attachments (`entry_files`)
  - Table + storage bucket + RLS policies and upload flow
- OCR + Enrichment
  - Edge Function stub; wire OCR service; store `ocr_text`; AI enrichment into `enriched_text`/`metadata`
- Search
  - Add `search_vector`, trigger, GIN index; basic `/search` UI
- Access control UX
  - Household creation/join screens; manage members and roles

## 11) Risks & Constraints
- Must not modify Supabase `auth` schema structure; referencing `auth.users` is OK but avoid schema mutations there
- Keep all sensitive operations on the server; do not expose service role key client‑side
- RLS must be in place before exposing new tables/APIs

## 12) Helpful File Pointers
- Routes: `nextjs/src/app/**/*`
- Supabase clients: `nextjs/src/lib/supabase/*`
- Demo pages (template): `nextjs/src/app/app/*`
- DB migrations: `supabase/migrations/*`
- Config: `supabase/config.toml`

## 13) Prompts AI Should Ask Before Changes
- Which household access patterns are required for this change?
- Does the new table/route need RLS, and what policies?
- Which client (server/client/admin) is appropriate for the data access?
- What is the desired UX route path and component boundaries?
- Do we need migrations, and how will they affect existing data?

---
This AGENTS.md should be kept up to date when schema, routes, or major flows change, so that future AI/context tools can reason reliably about the codebase.
