# AI Contribution Workflow (Django-First)

This file defines a safe process for AI-assisted changes in the active House repository.

## Principles

- Keep changes small and scoped.
- Prefer runtime truth over historical docs.
- Preserve household-scoped permissions for all domain updates.
- Avoid broad refactors unless explicitly requested.
- Update docs when behavior, APIs, or conventions change.

## Before changing code

1. Clarify goal, inputs/outputs, and acceptance criteria.
2. Identify affected areas:
   - Django models/migrations
   - DRF serializers/viewsets/permissions
   - Web templates and page routes
   - React mounts/components in `apps/*/react` and `ui/`
3. Confirm household permission implications.

## Data and permissions rules

- New business models should follow household scoping conventions.
- API routes must enforce member/owner semantics consistent with current app behavior.
- Never introduce cross-household access shortcuts.
- Validate household resolution path (`X-Household-Id` and fallbacks) for new endpoints.

## Implementation pattern

1. Read active routes and serializers first (`config/urls.py`, app `urls.py`, serializers/viewsets).
2. Implement minimal code changes in active stack.
3. Keep Django web routes (`web_urls.py`, `views_web.py`) separate from API views.
4. Keep React additions page-scoped and mounted into explicit template roots.

## Required documentation updates

When relevant, update:

- `AGENTS.md` for app map or key conventions
- docs in `docs/` for behavior/API/process changes
- app-level README when a module has specific operational rules

If a legacy document was the functional source, add a short note in the new active doc instead of copying old stack instructions.

## Validation checklist

- Django checks/tests for touched areas (`manage.py check`, targeted tests)
- No unrelated file churn
- Permissions still enforce household membership constraints
- UI routes and API endpoints remain consistent with docs

## When to request human input

- Ambiguous permission model changes
- Data migrations transforming existing production records
- External provider/security/billing decisions
- Product tradeoffs not inferable from active codebase
