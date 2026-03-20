---
name: fixtures-pattern
description: Tous les tests importent depuis e2e/fixtures.ts, pas depuis @playwright/test directement
type: feedback
---

Toujours importer `test` et `expect` depuis `./fixtures` (ou `../fixtures`), jamais depuis `@playwright/test`.

**Why:** `e2e/fixtures.ts` étend le `test` de Playwright avec les fixtures du projet (`loginAs`). Importer directement depuis `@playwright/test` prive les tests de ces helpers.

**How to apply:**
```typescript
// ✅ Correct
import { test, expect } from './fixtures';

// ❌ Interdit
import { test, expect } from '@playwright/test';
```

Fixture disponible : `loginAs(email, password)` — se connecte et vérifie la navigation vers `/app/dashboard`.
Les tests qui ont besoin d'une session vide utilisent `test.use({ storageState: { cookies: [], origins: [] } })` EN PLUS de l'import fixtures.
