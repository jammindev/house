# AI Update Workflow — How AIs Should Propose and Apply Changes

This playbook defines a safe, repeatable process for AI-driven changes. It emphasizes minimal, well‑scoped diffs, RLS‑first data modeling, and clear documentation updates so humans and tools can follow along.

## 0) Principles
- Small, scoped diffs: avoid unrelated refactors; change only what’s needed.
- RLS first: any new table or storage path must include access policies from day one.
- Server‑side secrets only: never expose service keys in client code.
- Keep docs in sync: update AGENTS.md and env templates when behavior or schema changes.
- Reversibility: think in migrations; each step should be easy to roll back.

## 1) Before You Change Anything
- Clarify the feature/idea in 5 lines: goal, inputs, outputs, users, success criteria.
- Identify impact areas: DB schema, storage, API routes, RSC actions, UI routes, env vars, scripts.
- Select the right Supabase client: browser client (public), server client (RSC), or admin client (service‑role; server only).

## 2) Database Changes (Migrations)
- Preferred via Yarn scripts:
  - Create: `yarn db:new <name>` (example: `yarn db:new add_entry_files`)
  - Apply: `yarn db:up`
  - List: `yarn db:list`
  - Reset (local dev): `yarn db:reset`
- Or manually: add a new SQL migration under `supabase/migrations/` with a timestamped name that describes the change (e.g., `YYYYMMDDHHMMSS_add_entry_files.sql`).
- Include in the same migration:
  - Table definition with explicit constraints and defaults
  - RLS `enable row level security`
  - Policies covering read/insert/update/delete aligned to household membership via `auth.uid()`
  - Needed indexes (BTREE for fkeys/filters, GIN for JSONB or full‑text)
  - Triggers for audit columns if necessary
- Never alter the `auth` schema; only reference `auth.users`.
- If using Storage, specify storage policies (or document a manual step) and a path convention that nests by `household_id`.
- Update AGENTS.md “Database Model” and “Roadmap” as needed.

Template fragment (adjust to your table):
```sql
-- create table
create table example (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table example enable row level security;

-- policies
create policy "Members can manage example in their household"
  on example for all
  using (exists (
    select 1 from household_members hm
    where hm.household_id = example.household_id
      and hm.user_id = auth.uid()
  ));
```

## 3) Environment & Config
- If new configuration is required, add the variable to `nextjs/.env.template` with a brief comment.
- Reference envs via `process.env` in server contexts; use `NEXT_PUBLIC_` only when truly safe for the client.
- Note any new envs in AGENTS.md “Environment & Secrets”.

## 4) App Changes (Next.js)
- Routes: add pages under `nextjs/src/app/...` following the existing routing structure.
- Data access:
  - RSC actions: use `src/lib/supabase/server.ts` client.
  - Client components: use `src/lib/supabase/client.ts` for user‑scoped reads/writes covered by RLS.
  - Admin operations (e.g., system tasks): only in server context via `serverAdminClient`.
- Types: extend `nextjs/src/lib/types.ts` if new domain types are introduced.
- UI: keep Tailwind/shadcn conventions; colocate small components in `src/components/`.
- Middleware/guards: extend `src/middleware.ts` or route-level checks if access rules change.

## 5) API & Edge Functions
- For server-only workflows (OCR, enrichment), add routes under `src/app/api/...` or Supabase Edge Functions.
- Ensure all server handlers validate inputs, respect RLS, and never expose service role keys to the client.
- Document any new endpoints in AGENTS.md “API & Edge Functions”.

## 6) Scripts & Tooling
- If a new developer action is needed (e.g., seeding, search indexing), add a script in root `package.json`.
- Keep script names concise and verbs consistent (`db:*`, `dev`, `build`, etc.).

## 7) Documentation Updates (Mandatory)
- AGENTS.md: update sections impacted by your change (Database Model, App Architecture, API, Environment, Roadmap).
- instructions.md: update product intent/roadmap if scope changed materially.
- README.md: update “Getting Started” only if the developer workflow changed.

## 8) Security Checklist (Always)
- RLS covers all new tables and storage policies.
- No service‑role usage in client bundles.
- Inputs validated at API boundaries; avoid mass‑assignment to unrestricted columns.
- Indexes exist for any new policy predicates used in frequent queries.

## 9) Change Checklist (Quick Copy‑Paste)
- [ ] Created SQL migration with RLS, policies, indexes
- [ ] Updated env template and documented new envs
- [ ] Implemented routes/components using correct Supabase client
- [ ] Added/updated API or Edge Function (server‑only secrets)
- [ ] Updated AGENTS.md and instructions.md as needed
- [ ] Added/updated package scripts if applicable
- [ ] Sanity-checked RLS paths and typical queries

## 10) Rollout & Verification
- Local: run `yarn db:migrate` (or `supabase migrations up --linked`), then `cd nextjs && yarn dev` and smoke test new flows.
- If adding search or background jobs, include a backfill or init script and document it.

## 11) When to Ask for Human Input
- Ambiguous RLS or cross‑household access patterns
- Data migrations that transform existing rows
- Any secret management or third‑party billing/integrations

---
Keep this document updated when the development process or conventions evolve. Link to this file from AGENTS.md (already done) so future AIs can act consistently.
