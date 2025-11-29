# Playwright E2E Guide for House

How we set up, seed, and write Playwright specs so they stay stable with our RLS-first, multi-tenant flows.

## Setup
- Env: copy `nextjs/.env.template` → `.env.local` and provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_KEY`. Keep secrets out of git.
- Install deps in `nextjs/`: `yarn` then `yarn playwright:install` (downloads browsers once).
- Running: from repo root `yarn test:e2e` (uses `nextjs/playwright.config.ts`). Set `PLAYWRIGHT_SKIP_WEB_SERVER=1` if you start Next.js yourself. Override base URL via `PLAYWRIGHT_BASE_URL` when pointing to a live server.
- Traces: enabled on first retry in CI, retained on failure locally (`trace`, screenshots, videos).
- Coverage: keep `tests/e2e/COVERAGE.md` updated with the journeys and behaviours currently exercised by the suite.

## Test data & fixtures
- We seed via Supabase service-role helpers in `nextjs/tests/e2e/utils/supabaseAdmin.ts` to respect RLS and storage rules.
  - `createTestUser()` → confirmed user + household + owner membership.
  - `createHouseholdMember()` → extra member in same household (use for cross-member actions).
  - `createZone()`, `createInteraction()` (aliased `createEntry()`), plus `countDocuments()`, `getInteractionById()`, and cleanup helpers.
  - Storage cleanup removes `${userId}/interactionId/*` in the `files` bucket after tests; keep uploads under that prefix in UI flows.
- Each spec should create its own users/households in `beforeEach` and clean them in `afterEach` to avoid cross-test coupling.
- Prefer UI for actions/assertions; only fall back to admin helpers for setup and verifying side effects (e.g., attachments deleted).

## Writing a new spec (recipe)
1) Choose the user journey (auth → action → assertion). Keep it business-relevant (household-scoped, attachments, RLS behaviours).
2) Arrange: in `beforeEach`, call `createTestUser()` (and optional zones/interactions). Store context locally and guard with a small `requireContext()` helper.
3) Act: navigate through the UI only—fill forms, click buttons, drag/drop. Reuse inline helpers inside the spec file (e.g., `signIn(page)`, `openEntriesList(page)` in `entries.spec.ts`).
4) Assert: use visible text/roles or dedicated `data-testid` for fragile elements. Validate both UI state and critical side effects (DB rows, storage counts) via admin helpers when needed.
5) Clean up: always `cleanupTestUser()` (and `cleanupHouseholdMember()` for extra members) in `afterEach`, even on failures.

### Skeleton
```ts
import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUser, createZone } from './utils/supabaseAdmin';

test.describe('feature name', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>> | null = null;
  const requireCtx = () => { if (!ctx) throw new Error('ctx missing'); return ctx; };

  test.beforeEach(async () => { ctx = await createTestUser(); });
  test.afterEach(async () => { if (ctx) await cleanupTestUser(ctx); ctx = null; });

  test('does the thing', async ({ page }) => {
    const { email, password } = requireCtx();
    const zone = await createZone(requireCtx());

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // UI steps...
    await page.goto('/app/interactions/new');
    await page.locator(`[data-zone-id="${zone.id}"]`).click();
    // Assertions...
    await expect(page.getByText(zone.name)).toBeVisible();
  });
});
```

## House-specific good practices
- RLS & multi-tenant: always scope data to the household created in the test. Use a second member when asserting cross-member permissions (e.g., deletion allowed).
- Zones: rely on `data-zone-id` selectors in the UI for stable clicks; assert inherited colour text rather than computed CSS when possible.
- Interactions/documents: when testing uploads, keep the fixture small (`fixtures/sample.txt`) and assert storage/DB cleanup via `countDocuments()` and `removeUserStorage`.
- Navigation overlay: use `page.waitForURL` after actions that trigger `LinkWithOverlay` navigation; avoid bare `waitForTimeout`.
- i18n: default locale is `en`; if you switch locale in a test, assert the new text and reset state in teardown.
- Selectors: prefer ARIA roles and labels; add `data-testid` for unstable text/copy changes before shipping the spec.
- Isolation: one user/household per `beforeEach`; no shared global state or cross-spec dependencies.

## Running tips
- Parallelism is on; keep specs independent and avoid reliance on ordering.
- For debugging, run a single spec: `yarn test:e2e tests/e2e/entries.spec.ts --debug`.
- If a test uses a running dev server, set `PLAYWRIGHT_SKIP_WEB_SERVER=1` to avoid double starts.
