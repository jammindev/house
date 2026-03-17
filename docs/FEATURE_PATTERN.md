# Feature Pattern — Spec for AI agents

Reference implementation: `ui/src/features/tasks/`. Read it before starting.

---

## 1. Architecture

```
ui/src/features/<feature>/     All React code for a feature
ui/src/lib/api/<feature>.ts    Types + pure fetch functions (no hooks)
ui/src/components/             Shared layout components
ui/src/design-system/          Low-level UI primitives (Button, Input, Dialog…)
ui/src/locales/<lang>/         i18n translation files (en, fr, es, de)

apps/<feature>/react/          MIGRATION SOURCE ONLY — read for UI/UX reference,
                               delete after migration, never import from here
```

**Vite aliases:**
- `@/` → `ui/src/`
- `@apps/` → `apps/` — do not use in new feature code

---

## 2. File structure per feature

```
ui/src/features/<feature>/
  <Feature>Page.tsx        required — top-level route component
  <Item>Card.tsx           required (list features) — renders one row/card
  <Item>Dialog.tsx         required (CRUD features) — create + edit form in a Dialog
  hooks.ts                 required — TanStack Query hooks only
  [<Sub>Section.tsx]       optional — if items are grouped into visual sections
  [<Feature>DetailPage.tsx] optional — if a detail/show route exists
```

One file per responsibility. No god files.

---

## 3. `@/lib/api/<feature>.ts`

This file already exists. Read it first. Add missing functions if needed.

```ts
// ── Types ────────────────────────────────────────────────────────────────────
export interface Item {
  id: string;
  name: string;
  // … all fields returned by the API
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const p = payload as { results?: T[] };
  return Array.isArray(p.results) ? p.results : [];
}

// ── Fetch functions (no React, no hooks) ─────────────────────────────────────
export async function fetchItems(): Promise<Item[]> {
  const res = await fetch('/api/<feature>/<endpoint>/', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return normalizeList(await res.json());
}

export async function createItem(payload: { name: string }): Promise<Item> {
  const res = await fetch('/api/<feature>/<endpoint>/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function updateItem(id: string, payload: Partial<Item>): Promise<Item> {
  const res = await fetch(`/api/<feature>/<endpoint>/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/<feature>/<endpoint>/${id}/`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok && res.status !== 404) throw new Error(`API error ${res.status}`);
}
```

> Auth is JWT — no CSRF token needed in fetch headers.

---

## 4. `hooks.ts`

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchItems, createItem, updateItem, deleteItem, type Item } from '@/lib/api/<feature>';

export const itemKeys = {
  all: ['<feature>'] as const,
  list: () => [...itemKeys.all, 'list'] as const,
  detail: (id: string) => [...itemKeys.all, 'detail', id] as const,
};

export function useItems() {
  return useQuery({ queryKey: itemKeys.list(), queryFn: fetchItems });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: itemKeys.all }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateItem>[1] }) =>
      updateItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: itemKeys.all }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: itemKeys.all }),
  });
}
```

**Optimistic update** — use when the mutation result is predictable (e.g. status change):

```ts
export function useUpdateItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateItem(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: itemKeys.list() });
      const previous = qc.getQueryData<Item[]>(itemKeys.list());
      qc.setQueryData<Item[]>(itemKeys.list(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)) ?? old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(itemKeys.list(), ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: itemKeys.all }),
  });
}
```

---

## 5. `<Feature>Page.tsx`

```tsx
import * as React from 'react';
import { SomeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useItems, useDeleteItem, itemKeys } from './hooks';
import type { Item } from '@/lib/api/<feature>';
import ItemCard from './<Item>Card';
import ItemDialog from './<Item>Dialog';

export default function <Feature>Page() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // UI state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<Item | null>(null);

  // Server state
  const { data: items = [], isLoading, error } = useItems();
  const deleteItemMutation = useDeleteItem();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: itemKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('<feature>.deleted'),
    onDelete: (id) => deleteItemMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      deleteWithUndo(itemId, {
        onRemove: () =>
          qc.setQueryData<Item[]>(itemKeys.list(), (old) => old?.filter((i) => i.id !== itemId)),
        onRestore: () =>
          qc.setQueryData<Item[]>(itemKeys.list(), (old) => (old ? [...old, item] : [item])),
      });
    },
    [items, deleteWithUndo, qc],
  );

  const isEmpty = !isLoading && !error && items.length === 0;

  return (
    <>
      <ListPage
        title={t('<feature>.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: SomeIcon,
          title: t('<feature>.empty'),
          description: t('<feature>.empty_description'),
          action: { label: t('<feature>.new'), onClick: () => setDialogOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('<feature>.new')}
          </button>
        }
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {t('<feature>.loadFailed')}
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: itemKeys.all })}
              className="ml-2 underline hover:no-underline"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="space-y-2">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} />
            ))}
          </div>
        ) : null}
      </ListPage>

      <ItemDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={handleSaved} />

      <ItemDialog
        open={editingItem !== null}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        existingItem={editingItem ?? undefined}
        onSaved={handleSaved}
      />
    </>
  );
}
```

---

## 6. `<Item>Card.tsx`

```tsx
import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/design-system/button';
import type { Item } from '@/lib/api/<feature>';

interface ItemCardProps {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (itemId: string) => void;
}

export default function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{/* metadata */}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(item.id)} aria-label="Supprimer" type="button">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(item)} aria-label="Modifier" type="button">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. `<Item>Dialog.tsx`

```tsx
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { createItem, updateItem, type Item } from '@/lib/api/<feature>';

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingItem?: Item;
}

export default function ItemDialog({ open, onOpenChange, onSaved, existingItem }: ItemDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingItem);

  const [name, setName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(existingItem?.name ?? '');
    setError(null);
  }, [open, existingItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const action = isEditing && existingItem
      ? updateItem(existingItem.id, { name })
      : createItem({ name });

    action
      .then(() => { setLoading(false); onOpenChange(false); onSaved(); })
      .catch(() => { setLoading(false); setError(t('common.saveFailed')); });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('<feature>.editTitle') : t('<feature>.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="item-name">
              {t('<feature>.fieldName')}
            </label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 8. Shared components reference

| Component | Import | Notes |
|-----------|--------|-------|
| `ListPage` | `@/components/ListPage` | Wrapper for list pages. Handles empty state + header. |
| `EmptyState` | `@/components/EmptyState` | Icon + title + description + CTA. Used by ListPage. |
| `ConfirmDialog` | `@/components/ConfirmDialog` | Delete confirmation dialog (alternative to `useDeleteWithUndo`). |
| `Button` | `@/design-system/button` | Variants: `default`, `outline`, `ghost`, `destructive`. |
| `Input` | `@/design-system/input` | Text inputs. |
| `Textarea` | `@/design-system/textarea` | Multi-line text. |
| `Select` | `@/design-system/select` | Dropdown — prop `options: {value, label}[]`. |
| `Dialog` | `@/design-system/dialog` | Always add `aria-describedby={undefined}` on `DialogContent` if no description. |
| `Badge` | `@/design-system/badge` | Variants: `default`, `secondary`, `outline`, `destructive`. |

---

## 9. Delete patterns

**`useDeleteWithUndo`** — for important items (shows undo toast, optimistic removal):
```tsx
const { deleteWithUndo } = useDeleteWithUndo({
  label: t('<feature>.deleted'),
  onDelete: (id) => deleteMutation.mutateAsync(id),
});
// onRemove / onRestore manipulate the TanStack cache via qc.setQueryData
```

**`ConfirmDialog`** — for less critical items or when undo is not appropriate:
```tsx
const [deletingId, setDeletingId] = React.useState<string | null>(null);

<ConfirmDialog
  open={deletingId !== null}
  onOpenChange={(open) => { if (!open) setDeletingId(null); }}
  onConfirm={() => { deleteMutation.mutate(deletingId!); setDeletingId(null); }}
  loading={deleteMutation.isPending}
/>
```

Never use `window.confirm()`.

---

## 10. Translations

**4 locales to update, always all at once:** `en`, `fr`, `es`, `de`

Files: `ui/src/locales/<lang>/translation.json`

Each feature gets a top-level namespace key matching the feature name. Required keys for every feature:

```json
"<feature>": {
  "title": "…",
  "new": "…",
  "newTitle": "…",
  "editTitle": "…",
  "empty": "…",
  "empty_description": "…",
  "deleted": "…",
  "loadFailed": "…",
  "fieldName": "…"
}
```

Add extra keys as needed (field labels, filter labels, section titles, error messages…). Look at the existing `tasks` namespace in each file for the exact style.

**`common` keys already available in all locales:**

```
common.save / common.saving / common.cancel
common.edit / common.delete / common.archive
common.confirmDelete / common.retry / common.saveFailed
```

Use `common.*` for generic labels. Add to `common` only if the key will be reused across multiple features.

**Reference — tasks translations structure (adapt for your feature):**
```json
"tasks": {
  "title": "…",
  "new": "…",
  "newTask": "…",
  "editTitle": "…",
  "loadFailed": "…",
  "empty": "…",
  "deleted": "…",
  "fieldSubject": "…",
  "fieldZone": "…",
  "fieldDate": "…",
  "fieldContent": "…",
  "sections": { "overdue": "…", "in_progress": "…", "pending": "…", "backlog": "…", "done": "…" },
  "filter": { "all": "…", "pending": "…", "in_progress": "…", "backlog": "…", "done": "…" }
}
```

---

## 11. Legacy migration process

1. Read `apps/<feature>/react/` — understand the UI layout, components decomposition, domain logic
2. Read `apps/<feature>/react/hooks/` and `lib/` — extract business logic to port
3. Check `ui/src/lib/api/<feature>.ts` — verify types and fetch functions are complete
4. Implement in `ui/src/features/<feature>/` following this pattern
5. Delete `apps/<feature>/react/` once the migration is validated

---

## 12. Per-feature checklist

Copy this block for each feature migration.

### `<feature>` migration

**API layer**
- [ ] `ui/src/lib/api/<feature>.ts` — types complete and accurate
- [ ] `fetchItems()` implemented and tested manually
- [ ] `createItem()` / `updateItem()` / `deleteItem()` implemented

**Hooks**
- [ ] `hooks.ts` — `use<Feature>s()`, `useCreate<Feature>()`, `useUpdate<Feature>()`, `useDelete<Feature>()`
- [ ] Optimistic update added for status/position changes (if applicable)

**Components**
- [ ] `<Feature>Page.tsx` — uses `ListPage`, handles `isLoading` / `error` / `isEmpty`
- [ ] `<Item>Card.tsx` — edit + delete actions present
- [ ] `<Item>Dialog.tsx` — handles create and edit (driven by `existingItem` prop)
- [ ] Delete uses `useDeleteWithUndo` or `ConfirmDialog` — no `window.confirm()`

**Translations (all 4 locales: en, fr, es, de)**
- [ ] `en/translation.json` — `<feature>` namespace added with all keys
- [ ] `fr/translation.json` — translated
- [ ] `es/translation.json` — translated
- [ ] `de/translation.json` — translated
- [ ] All `t()` calls in components have a matching key (no `defaultValue` fallbacks in production code)

**Cleanup**
- [ ] No imports from `@apps/` in new feature code
- [ ] `apps/<feature>/react/` deleted (or confirmed unused)
- [ ] `npx tsc --noEmit` passes with no errors (run from `ui/`)
