import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShoppingCart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import type { ShoppingListItem } from '@/lib/api/shopping';
import {
  shoppingKeys,
  useBulkDeleteShoppingItems,
  useCreateShoppingItem,
  useDeleteShoppingItem,
  useShoppingItems,
  useUpdateShoppingItem,
} from './hooks';
import ShoppingListItemRow from './ShoppingListItemRow';
import ShoppingItemDialog from './ShoppingItemDialog';

export default function ShoppingListPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cacheKey = shoppingKeys.list();

  const { data: items = [], isLoading } = useShoppingItems();
  const createMutation = useCreateShoppingItem();
  const updateMutation = useUpdateShoppingItem();
  const deleteMutation = useDeleteShoppingItem();
  const bulkDeleteMutation = useBulkDeleteShoppingItems();

  const [quickAdd, setQuickAdd] = React.useState('');
  const [editing, setEditing] = React.useState<ShoppingListItem | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const showSkeleton = useDelayedLoading(isLoading);

  const toBuy = items.filter((i) => !i.checked);
  const taken = items.filter((i) => i.checked);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('shoppingList.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  const clearedIdsRef = React.useRef<string[]>([]);
  const { deleteWithUndo: clearWithUndo } = useDeleteWithUndo({
    label: t('shoppingList.clearedChecked'),
    // The ids to drop are snapshotted at trigger time (clearedIdsRef).
    onDelete: () => bulkDeleteMutation.mutateAsync(clearedIdsRef.current),
  });

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const label = quickAdd.trim();
    if (!label) return;
    setQuickAdd('');
    await createMutation.mutateAsync({ label });
  }

  function toggle(item: ShoppingListItem) {
    // Optimistic flip so the checkbox feels instant.
    qc.setQueryData<ShoppingListItem[]>(cacheKey, (old) =>
      old?.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
    updateMutation.mutate({ id: item.id, payload: { checked: !item.checked } });
  }

  function openEdit(item: ShoppingListItem) {
    setEditing(item);
    setDialogOpen(true);
  }

  function remove(item: ShoppingListItem) {
    deleteWithUndo(item.id, {
      onRemove: () =>
        qc.setQueryData<ShoppingListItem[]>(cacheKey, (old) => old?.filter((i) => i.id !== item.id)),
      onRestore: () =>
        qc.setQueryData<ShoppingListItem[]>(cacheKey, (old) => (old ? [...old, item] : [item])),
    });
  }

  function clearChecked() {
    const checkedItems = taken;
    if (!checkedItems.length) return;
    clearedIdsRef.current = checkedItems.map((i) => i.id);
    clearWithUndo('clear-checked', {
      onRemove: () =>
        qc.setQueryData<ShoppingListItem[]>(cacheKey, (old) => old?.filter((i) => !i.checked)),
      onRestore: () =>
        qc.setQueryData<ShoppingListItem[]>(cacheKey, (old) => {
          const present = new Set((old ?? []).map((i) => i.id));
          const restored = checkedItems.filter((i) => !present.has(i.id));
          return old ? [...old, ...restored] : restored;
        }),
    });
  }

  return (
    <div>
      <PageHeader title={t('shoppingList.title')} />

      <form onSubmit={handleQuickAdd} className="mb-4 flex gap-2">
        <Input
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          placeholder={t('shoppingList.quickAdd.placeholder')}
          aria-label={t('shoppingList.quickAdd.placeholder')}
        />
        <Button type="submit" disabled={!quickAdd.trim()} className="shrink-0 gap-1">
          <Plus className="h-4 w-4" />
          {t('shoppingList.quickAdd.button')}
        </Button>
      </form>

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t('shoppingList.empty.title')}
          description={t('shoppingList.empty.description')}
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            {toBuy.map((item) => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                onToggle={toggle}
                onEdit={openEdit}
                onDelete={remove}
              />
            ))}
            {toBuy.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                {t('shoppingList.allTaken')}
              </p>
            ) : null}
          </div>

          {taken.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('shoppingList.takenSection', { count: taken.length })}
                </h2>
                <Button type="button" variant="ghost" size="sm" onClick={clearChecked}>
                  {t('shoppingList.clearChecked')}
                </Button>
              </div>
              {taken.map((item) => (
                <ShoppingListItemRow
                  key={item.id}
                  item={item}
                  onToggle={toggle}
                  onEdit={openEdit}
                  onDelete={remove}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      <ShoppingItemDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
    </div>
  );
}
