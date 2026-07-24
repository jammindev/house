---
name: project_detail_tabs_patterns
description: Patterns for testing the ProjectDetailPage TabShell (adaptive tabs) and EntityPhotosTab (before/after photos). Added for parcours 20.
type: patterns
---

# Project Detail — TabShell & EntityPhotosTab patterns

## TabShell adaptive tabs

- **Tab pills** are `getByRole('button', { name: 'Aperçu' })` etc. They are `FilterPill` components that render as `<button>`.
- **"Overview" tab** (`Aperçu`) is always visible.
- **Adaptive tabs** (Tâches, Photos, Notes, Dépenses, Documents, Trackers, Historique) are hidden when `tab_counts[tab] === 0`.
- **"+" menu** for hidden tabs: `getByRole('button', { name: 'Afficher plus' })` — dashed border button with `aria-label={t('common.showMore')}` = "Afficher plus". Hidden tabs appear as `getByRole('menuitem', { name: '...' })` inside a Radix `DropdownMenu`.
- **After task creation**, `tab_counts` is refreshed via `qc.invalidateQueries({ queryKey: projectKeys.detail(id) })` — the Tasks pill then appears in the bar.

## Project creation via API (for blank-project tests)

Use this pattern to create a blank project and navigate directly to its detail without touching the UI list/filter:

```typescript
const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
const resp = await page.request.post('/api/projects/projects/', {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  data: { title, status: 'active', type: 'other', priority: 3 },
});
const { id } = await resp.json();
await page.goto(`/app/projects/${id}`);
await expect(page.getByRole('heading', { name: title })).toBeVisible();
```

Always clean up with a DELETE in `afterEach`.

Note: **do NOT use `status: 'draft'`** for projects created in tests — the `/app/projects` list defaults to filter `status: active`, so draft projects won't appear if tests need to navigate via the list.

## EntityPhotosTab — upload flow

- **Upload button**: `getByRole('button', { name: 'Ajouter une photo' })` — primary button in the tab.
- **Upload dialog**: opens as `SheetDialog` (renders with `role="dialog"`). File input has `id="upload-file"`, submit button = `getByRole('button', { name: 'Téléverser' })`.
- After upload, dialog closes (`toBeHidden()`) and the photo lands in "Non classées" section.
- **Empty state text**: `'Aucune photo. Ajoutez-en pour documenter l\'avant et l\'après du projet.'`

## EntityPhotosTab — phase sections & tile actions

- Sections are `<section>` elements containing the phase label as text.
- Scope tile lookups to the section: `page.locator('section').filter({ hasText: 'Non classées' })`.
- The CardActions menu button is the **last `<button>`** inside the tile (`[class*="overflow-hidden"]`).
- Phase move items: `getByRole('menuitem', { name: /Déplacer vers Avant/ })` etc.
- Phase section names: "Avant", "Pendant", "Après", "Non classées" (from `photos.phase.*` translations).

## BeforeAfterCompare dialog

- **"Comparer" button** only appears when `hasBefore && hasAfter` — `getByRole('button', { name: 'Comparer' })`.
- Compare dialog title: "Avant / après" (`photos.entity.compareTitle`).
- Range slider: `compareDialog.locator('input[type="range"]')`.

## project-tasks.spec.ts conventions (for reference)

- Seeded project: `'Rénovation salle de bain'` — already has tasks, so the Tasks tab is already visible.
- Navigate: `page.goto('/app/projects')` → click link → click `getByRole('button', { name: 'Tâches' })`.
- `createTask` fixture works from the Tasks panel (empty state button) and from the header button.
