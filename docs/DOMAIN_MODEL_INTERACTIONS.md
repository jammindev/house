# Domain Model — Interaction-Centric Design

## Why interactions are central

House models household activity as a unified event stream.

An interaction is a timestamped record representing a real-world event:
- note
- todo
- expense
- maintenance action
- document-related action
- other household activity

This avoids fragmented feature silos and keeps search, timeline, and AI context consistent.

## Tenant boundary

Every domain entity is scoped to a household.

- household membership controls visibility and actions
- owner-only actions remain restricted (membership management and sensitive updates)
- API access resolves household context via header/params/fallback membership selection

See `../AGENTS.md` for current permission conventions.

## Core entities

- `households`: tenant root
- `interactions`: event timeline backbone
- `documents`: files and metadata, linked to interactions
- `zones`: hierarchical home structure
- `contacts`: people
- `structures`: organizations/service providers
- `tags`: optional categorization
- `equipment`: household equipment lifecycle and related interactions
- `projects`: higher-level grouping and planning context
- `electricity`: electrical board topology and change log
- `incoming_emails`: inbound mail records and attachments for processing workflows

## Typical relationship flow

1. User captures an interaction
2. Interaction may be linked to:
   - one or more documents
   - contact/structure
   - zone/project/equipment context
   - tags and status metadata
3. Timeline and app-specific views surface the event with context links

## Design consequences

- Feature additions can often start as new interaction types/metadata.
- Rich modules (projects/electricity/equipment) still integrate with interaction history.
- AI workflows benefit from a single contextual substrate rather than scattered domain logs.

## Migration note

Legacy documentation describes a similar interaction-first intent, but storage/auth details there target Supabase-era patterns. For implementation, rely on Django models, serializers, and DRF permissions in active apps.
