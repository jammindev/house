# Feature Status and RFC Sources

This page maps legacy feature documents to their status in the active Django codebase.

## Status labels

- **Active**: feature exists in active runtime code
- **Partial**: foundational models/APIs exist, advanced flow is incomplete
- **RFC/Archive**: legacy proposal or historical implementation note

## Feature mapping

### Incoming email ingestion

- Legacy source: `../legacy/README-email-ingestion.md`
- Active status: **Partial**
- Notes: `incoming_emails` app exists (models/API foundation). Advanced automated pipeline and full UX from legacy doc are not fully ported.

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
