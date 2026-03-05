# Feature Status and RFC Sources

This page maps legacy feature documents to their status in the active Django codebase.

Current baseline: data migration from Supabase to Django is complete for active runtime modules; current priority is UI completion across all apps.

## Status labels

- **Active**: feature exists in active runtime code
- **UI In Progress**: backend/data are in place, UI workflows still being completed
- **RFC/Archive**: legacy proposal or historical implementation note

## Feature mapping

### Incoming email ingestion

- Legacy source: `../legacy/README-email-ingestion.md`
- Active status: **RFC/Archive**
- Notes: legacy source remains useful for intent, but this domain is currently outside the active UI-first implementation scope.

### Interaction specialized routes (legacy Next.js)

- Legacy source: `../legacy/INTERACTION_ROUTES.md`
- Active status: **RFC/Archive**
- Notes: route/component names in this file are Next.js-era references; use Django/React active routes instead.

### Insurance feature

- Legacy source: `../legacy/INSURANCE_FEATURE.md`
- Active status: **RFC/Archive**
- Notes: useful as UI/domain pattern reference, not as active module in current Django app list.

### AI project wizard implementation

- Legacy source: `../legacy/PROJECT_WIZARD_IMPLEMENTATION.md`
- Active status: **RFC/Archive**
- Notes: documents a Supabase/Next.js implementation milestone; current `projects` app should be treated independently in Django runtime.

## Security features (active)

### Rate limiting — login endpoint

- Active status: **Active**
- Implementation: `apps/accounts/throttles.py`
- Rules:
  - `LoginIPRateThrottle`: 20 attempts/min per IP (blocks scans/bots)
  - `LoginEmailRateThrottle`: 5 attempts/min per email (blocks targeted brute-force)
- Config: `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES` in `config/settings/base.py`
- Cache: DRF default (`LocMemCache` in dev). For prod with multiple Gunicorn workers, set `CACHES` to Redis (`django-redis`) so the counter is shared across processes.
- Response: `HTTP 429 Too Many Requests` when limit is exceeded.
- Only applied to `POST /api/accounts/auth/login/`; all other endpoints are unaffected.

## Active modules (runtime)

The following modules are active in current runtime and should be documented from Django code, not legacy behavior:

- accounts
- households
- zones
- interactions
- documents
- contacts
- structures
- tags
- equipment
- projects
- electricity
- incoming_emails
- tasks (web mini-app)
- photos (web mini-app)
- app_settings (web mini-app)

See `../AGENTS.md` for details and endpoint map.

## Usage guidance

When implementing or documenting a feature:

1. Verify current behavior in active apps/routes.
2. Use legacy doc only for product intent or migration hints.
3. Mark speculative/unfinished capabilities explicitly as RFC.
4. Prioritize end-user UI delivery in active Django apps.
