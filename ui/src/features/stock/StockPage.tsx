import * as React from 'react';
import { Package, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import ConfirmDialog from '@/components/ConfirmDialog';
import { TabShell } from '@/components/TabShell';
import { FilterBar } from '@/design-system/filter-bar';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { StockItem, StockCategory } from '@/lib/api/stock';
import {
  useStockItems,
  useStockCategories,
  useZones,
  useDeleteStockItem,
  useDeleteCategory,
  stockKeys,
} from './hooks';
import StockItemCard from './StockItemCard';
import StockItemDialog from './StockItemDialog';
import StockCategoryCard from './StockCategoryCard';
import StockCategoryDialog from './StockCategoryDialog';

type ActiveTab = 'items' | 'categories';

const STATUS_OPTIONS = ['', 'in_stock', 'low_stock', 'out_of_stock', 'ordered', 'expired', 'reserved'];

export default function StockPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [zone, setZone] = React.useState('');
  const [category, setCategory] = React.useState('');

  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<StockItem | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<StockCategory | null>(null);

  const [deletingCategoryId, setDeletingCategoryId] = React.useState<string | null>(null);

  const filters = React.useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(zone ? { zone } : {}),
      ...(category ? { category } : {}),
    }),
    [search, status, zone, category],
  );

  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useStockItems(filters);
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useStockCategories();
  const { data: zones = [] } = useZones();

  const deleteItemMutation = useDeleteStockItem();
  const deleteCategoryMutation = useDeleteCategory();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: stockKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('stock.deleted'),
    onDelete: (id) => deleteItemMutation.mutateAsync(id),
  });

  const handleDeleteItem = React.useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      deleteWithUndo(itemId, {
        onRemove: () =>
          qc.setQueryData<StockItem[]>(stockKeys.items(filters), (old) =>
            old?.filter((i) => i.id !== itemId),
          ),
        onRestore: () =>
          qc.setQueryData<StockItem[]>(stockKeys.items(filters), (old) =>
            old ? [...old, item] : [item],
          ),
      });
    },
    [items, deleteWithUndo, qc, filters],
  );

  function resetFilters() {
    setSearch('');
    setStatus('');
    setZone('');
    setCategory('');
  }

  const openNewCategory = React.useCallback(() => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  }, []);

  const isItemsEmpty = !itemsLoading && !itemsError && items.length === 0;
  const isCategoriesEmpty = !categoriesLoading && !categoriesError && categories.length === 0;
  const showItemsSkeleton = useDelayedLoading(itemsLoading);
  const showCategoriesSkeleton = useDelayedLoading(categoriesLoading);

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'items', label: t('stock.tabs.items') },
    { key: 'categories', label: t('stock.tabs.categories') },
  ];

  return (
    <>
      <TabShell
        tabs={TABS}
        sessionKey="stock.tab"
        defaultTab="items"
        actions={(tab) => {
          if (tab === 'items') {
            return (
              <button
                type="button"
                onClick={() => setItemDialogOpen(true)}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t('stock.actions.new_item')}
              </button>
            );
          }
          if (tab === 'categories') {
            return (
              <button
                type="button"
                onClick={openNewCategory}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {t('stock.actions.new_category')}
              </button>
            );
          }
          return null;
        }}
      >
        {(tab) => (
          <>
            {tab === 'items' ? (
              <ListPage
                title={t('stock.title')}
                isEmpty={isItemsEmpty}
                emptyState={{
                  icon: Package,
                  title: t('stock.empty.items'),
                  description: t('stock.empty_description'),
                  action: { label: t('stock.actions.new_item'), onClick: () => setItemDialogOpen(true) },
                }}
              >
                <div className="space-y-4">
                  <FilterBar
                    fields={[
                      {
                        type: 'search',
                        id: 'stock-search',
                        label: t('stock.fields.search'),
                        value: search,
                        onChange: setSearch,
                        placeholder: t('stock.fields.search_placeholder'),
                      },
                      {
                        type: 'select',
                        id: 'stock-status',
                        label: t('stock.fields.status'),
                        value: status,
                        onChange: setStatus,
                        options: STATUS_OPTIONS.map((s) => ({
                          value: s,
                          label: s ? t(`stock.status.${s}`) : t('stock.fields.all_statuses'),
                        })),
                      },
                      {
                        type: 'select',
                        id: 'stock-zone',
                        label: t('stock.fields.zone'),
                        value: zone,
                        onChange: setZone,
                        options: [
                          { value: '', label: t('stock.fields.all_zones') },
                          ...zones.map((z) => ({
                            value: z.id,
                            label: z.full_path || z.name,
                          })),
                        ],
                      },
                      {
                        type: 'select',
                        id: 'stock-category',
                        label: t('stock.fields.category'),
                        value: category,
                        onChange: setCategory,
                        options: [
                          { value: '', label: t('stock.fields.all_categories') },
                          ...categories.map((cat) => ({
                            value: cat.id,
                            label: `${cat.emoji} ${cat.name}`,
                          })),
                        ],
                      },
                    ]}
                    onReset={resetFilters}
                    hasActiveFilters={!!(search || status || zone || category)}
                    resetLabel={t('stock.actions.reset')}
                    applyLabel={t('stock.actions.apply')}
                  />

                  {itemsError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {t('stock.errors.load_failed')}
                      <button
                        type="button"
                        onClick={() => qc.invalidateQueries({ queryKey: stockKeys.all })}
                        className="ml-2 underline hover:no-underline"
                      >
                        {t('common.retry')}
                      </button>
                    </div>
                  ) : null}

                  {showItemsSkeleton ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                      ))}
                    </div>
                  ) : null}

                  {!itemsLoading && !itemsError ? (
                    <ul className="space-y-3">
                      {items.map((item) => (
                        <StockItemCard
                          key={item.id}
                          item={item}
                          onEdit={setEditingItem}
                          onDelete={handleDeleteItem}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              </ListPage>
            ) : null}

            {tab === 'categories' ? (
              <ListPage
                title={t('stock.title')}
                isEmpty={isCategoriesEmpty}
                emptyState={{
                  icon: Tag,
                  title: t('stock.empty.categories'),
                  description: t('stock.empty_categories_description'),
                  action: { label: t('stock.actions.new_category'), onClick: openNewCategory },
                }}
              >
                <div className="space-y-4">
                  {categoriesError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {t('stock.errors.load_failed')}
                      <button
                        type="button"
                        onClick={() => qc.invalidateQueries({ queryKey: stockKeys.all })}
                        className="ml-2 underline hover:no-underline"
                      >
                        {t('common.retry')}
                      </button>
                    </div>
                  ) : null}

                  {showCategoriesSkeleton ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                      ))}
                    </div>
                  ) : null}

                  {!categoriesLoading && !categoriesError ? (
                    <ul className="space-y-3">
                      {categories.map((cat) => (
                        <StockCategoryCard
                          key={cat.id}
                          category={cat}
                          onEdit={(c) => {
                            setEditingCategory(c);
                            setCategoryDialogOpen(true);
                          }}
                          onDelete={setDeletingCategoryId}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              </ListPage>
            ) : null}
          </>
        )}
      </TabShell>

      <StockItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSaved={handleSaved}
      />
      <StockItemDialog
        open={editingItem !== null}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        existingItem={editingItem ?? undefined}
        onSaved={handleSaved}
      />

      <StockCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        existingCategory={editingCategory ?? undefined}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deletingCategoryId !== null}
        onOpenChange={(open) => { if (!open) setDeletingCategoryId(null); }}
        title={t('common.confirmDelete')}
        description={
          deletingCategoryId
            ? t('stock.categories.confirm_delete', {
                name: categories.find((c) => c.id === deletingCategoryId)?.name ?? '',
              })
            : undefined
        }
        onConfirm={() => {
          if (deletingCategoryId) {
            deleteCategoryMutation.mutate(deletingCategoryId);
            setDeletingCategoryId(null);
          }
        }}
        loading={deleteCategoryMutation.isPending}
      />
    </>
  );
}
