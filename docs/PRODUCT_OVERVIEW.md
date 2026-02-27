# Product Overview (Active Codebase)

## Mission

House is a household knowledge system that centralizes operational memory for a home: notes, tasks, expenses, maintenance events, documents, contacts, structures, projects, and electrical mapping.

The product is built around one principle: **capture events first, enrich later**.

## Current architecture baseline

- Backend: Django + DRF (session auth, household-scoped permissions)
- Frontend: Django templates with page-scoped React mini-SPAs
- Multi-tenant scope: household membership and role-based actions
- Internationalization: English/French in UI surfaces

See `../AGENTS.md` for the complete app map.

## Core capabilities (active)

- Household membership and owner/member role model
- Interaction timeline (notes, todos, expenses, maintenance, etc.)
- Zone hierarchy and household spatial organization
- Document management linked to interactions
- Contacts and structures directories
- Equipment lifecycle and interaction links
- Project planning and project-linked entities
- Electrical board model (boards, RCDs, breakers, circuits, links)
- Incoming email ingestion foundation (models/APIs present)

## Interaction-first model

The interaction model is the central event stream:

- one record per household event/action
- typed events (`note`, `todo`, `expense`, etc.)
- optional links to contacts, structures, documents, tags, zones, projects
- timeline and filtering workflows built from this shared backbone

This design enables progressive product growth without deep schema rewrites for each new feature.

## Product boundaries (important)

- Legacy Next.js/Supabase docs often describe advanced or planned workflows.
- In this repository, those docs are **reference intent**, not active implementation.
- Active behavior must always be validated against Django apps and routes.

## Long-term direction

- Keep runtime stable and template-first where appropriate
- Add focused React mini-SPAs per page for rich interactions
- Expand AI-assisted workflows incrementally (projects/incoming emails/documents)
- Preserve strict household scoping and explicit permissions as non-negotiable constraints
