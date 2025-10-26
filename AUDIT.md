# House — Architecture & Security Audit

_Date: 2025-02-15_

## 1. Executive Summary
- **Scope.** Review of the Next.js frontend, Supabase integration, and database security policies shipped in this repository.
- **Overall posture.** The project already leans on Supabase row-level security (RLS) and server-only service-key usage, which provides a solid baseline. The main gaps are around tightening client authentication flows, keeping generated types in sync with the schema, and documenting hardening tasks (rate limiting, secrets hygiene) before production.

## 2. Architecture Snapshot
- **Frontend composition.** The `/app` dashboard is implemented as a client-side layout that injects a global provider, toast system, and responsive shell with sidebar/topbar navigation, all rendered inside `AppLayout`. Household scoping, logout, and navigation are handled in React context rather than per-page loaders. 【F:nextjs/src/app/app/layout.tsx†L1-L16】【F:nextjs/src/components/layout/AppLayout.tsx†L1-L64】
- **State & data access.** `GlobalContext` establishes user/household state on the client by instantiating an authenticated Supabase browser client, persisting the selected household in `localStorage`, and querying household membership on mount. Downstream pages reuse this context for filtering Supabase reads. 【F:nextjs/src/lib/context/GlobalContext.tsx†L1-L69】
- **Domain features.** The dashboard fetches interaction, zone, and contact metrics per household from Supabase; zones management hooks allow CRUD with optimistic UI around the same context. These flows run entirely in the browser via the shared Supabase client. 【F:nextjs/src/app/app/page.tsx†L1-L131】【F:nextjs/src/app/app/zones/page.tsx†L1-L101】
- **Backend & RPC.** Server routes use the SSR Supabase client for session-aware operations and fall back to an admin client only when the service role is required (e.g., resolving user emails for audit trails). Household creation delegates to a `SECURITY DEFINER` RPC that atomically inserts the household and owner membership. 【F:nextjs/src/app/api/interactions/[id]/audit/route.ts†L1-L87】【F:supabase/migrations/20250924121000_update_household_rpc_security.sql†L1-L35】
- **Database security.** RLS is enforced on core tables (`households`, `household_members`, `zones`, `interactions`, etc.), ensuring access is scoped via membership. Storage access is constrained to the uploading user’s key prefix within the `files` bucket. 【F:supabase/migrations/20250921081621_create_households.sql†L1-L7】【F:supabase/migrations/20250921081718_create_household_members.sql†L1-L23】【F:supabase/migrations/20250921081746_create_zones.sql†L1-L18】【F:supabase/migrations/20251016120000_refactor_entries_to_interactions.sql†L64-L121】【F:supabase/migrations/20250924093000_fix_storage_policies_owner_only.sql†L1-L43】

## 3. Security Posture
### Strengths
- **RLS-first schema.** Every domain table examined enforces RLS policies keyed off `household_members`, preventing cross-tenant access even if client-side controls fail. 【F:supabase/migrations/20250921081718_create_household_members.sql†L1-L23】【F:supabase/migrations/20251016120000_refactor_entries_to_interactions.sql†L64-L121】
- **Service key isolation.** The admin Supabase client disables cookie persistence and is only instantiated inside API routes, limiting exposure of the service role key. 【F:nextjs/src/lib/supabase/serverAdminClient.ts†L1-L23】【F:nextjs/src/app/api/interactions/[id]/audit/route.ts†L12-L87】
- **Storage hardening.** Storage policies restrict all CRUD operations to the uploader’s `auth.uid()` namespace, blocking horizontal access between household members by default. 【F:supabase/migrations/20250924093000_fix_storage_policies_owner_only.sql†L13-L43】
- **Browser client sanitisation.** File uploads sanitize filenames before prefixing them with the current user ID to comply with storage policies. 【F:nextjs/src/lib/supabase/unified.ts†L44-L60】

### Observed Gaps
1. **Authenticated SPA client still resolves when session is missing (Medium).** `createSPASassClientAuthenticated` redirects on missing sessions but continues returning a live client, so downstream code can execute unauthenticated Supabase reads before the navigation completes. Guarding with a thrown error (or awaiting the redirect) would avoid transient unauthorized calls. 【F:nextjs/src/lib/supabase/client.ts†L17-L24】
2. **Admin audit endpoint lacks household-level rate limiting/logging (Medium).** The audit API validates membership but invokes `auth.admin.getUserById` for every interaction view, which could leak timing information or open brute-force enumeration if abused. Introduce rate limiting and audit logging before exposing this route publicly. 【F:nextjs/src/app/api/interactions/[id]/audit/route.ts†L12-L87】
3. **Generated `Database` types drift from schema (Low).** `types.ts` still lists legacy relations (`interaction_documents`, `interaction_structures`, etc.), risking runtime type mismatches against the current migrations. Regenerate Supabase types after each schema change. 【F:nextjs/src/lib/types.ts†L1-L120】
4. **Operational hardening TODOs.** Environment scaffolding is incomplete (`.env.template` absent) and there is no documented secret rotation, rate limiting, or monitoring plan. Production readiness requires those controls plus enforcement of HTTPS, CSP, and consistent GA/GTM consent to match analytics usage. 【F:nextjs/src/app/layout.tsx†L1-L35】【F:nextjs/package.json†L1-L61】

## 4. Recommendations
| Priority | Recommendation | Rationale |
| --- | --- | --- |
| High | Update `createSPASassClientAuthenticated` to throw/return early when no session exists, and wrap consumer hooks/components with a suspense/error state. | Prevents unauthenticated Supabase traffic during redirect loops and keeps client behaviour predictable. 【F:nextjs/src/lib/supabase/client.ts†L17-L24】 |
| High | Add middleware or API guards that enforce rate limiting (e.g., IP/session buckets) and structured logging on admin-powered routes. | Limits abusive access to service-role RPCs and surfaces anomalies quickly. 【F:nextjs/src/app/api/interactions/[id]/audit/route.ts†L12-L87】 |
| Medium | Regenerate Supabase TypeScript definitions (`supabase gen types typescript --linked`) and automate the step in CI. | Restores end-to-end type safety for queries/mutations and prevents stale template artifacts. 【F:nextjs/src/lib/types.ts†L1-L120】 |
| Medium | Reintroduce an `.env.template` documenting required keys and ensure secrets (especially `PRIVATE_SUPABASE_SERVICE_KEY`) are injected via infrastructure secrets managers. | Reduces setup friction and lowers risk of misconfigured environments that expose service keys. 【F:nextjs/src/lib/supabase/serverAdminClient.ts†L1-L23】 |
| Medium | Document and implement CSP, Strict-Transport-Security, and cookie security attributes once hosting is defined. | Completes the web hardening story to complement Supabase RLS. 【F:nextjs/src/app/layout.tsx†L1-L35】 |
| Low | Audit remaining template features (todo list, Paddle billing) and remove or gate them to avoid dead routes with permissive policies. | Shrinks attack surface and clarifies supported functionality. 【F:nextjs/src/lib/supabase/unified.ts†L66-L89】【F:nextjs/package.json†L1-L61】 |

## 5. Suggested Next Steps
1. **Security fixes.** Harden the SPA auth helper and the audit route, then add observability/rate limiting primitives.
2. **Schema hygiene.** Regenerate Supabase types, review migrations for unused objects, and update the onboarding documentation (README/env template).
3. **Operational readiness.** Define deployment environment controls (secret storage, logging, monitoring) and align analytics usage with consent banner behaviour.

---
_This document reflects repository state as inspected on 2025-02-15._
