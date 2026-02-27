# Legacy Archive Policy

The `legacy/` folder is retained as a **historical archive** during migration from Next.js/Supabase to Django/DRF + templates + targeted React.

## Rules

- `legacy/` is not runtime source of truth.
- Active behavior must be documented from current Django code.
- Legacy docs are used for:
  - business intent
  - migration rationale
  - historical decisions

## How to consume legacy docs safely

1. Identify whether the document describes product intent, implementation details, or both.
2. Extract intent into active docs under `docs/`.
3. Do not copy stack-specific instructions that target obsolete runtime paths.
4. If a legacy doc remains useful only as history, keep it in place and reference it as archive.

## Required labeling

- Legacy entrypoints should warn readers that content may be historical.
- Active docs should point to legacy only when context cannot be represented succinctly.

## Migration outcomes expected

- Canonical docs live in `docs/`, root `README.md`, and app-level docs where needed.
- Legacy docs remain available for traceability.
- Contradictions are resolved in favor of active runtime code.
