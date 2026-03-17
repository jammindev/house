import * as React from 'react';
import { Package, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { FilterBar } from '@/design-system/filter-bar';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
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

  // Tab state
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('items');

  // Item filters
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [zone, setZone] = React.useState('');
  const [category, setCategory] = React.useState('');

  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<StockItem | null>(null);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<StockCategory | null>(null);

  // Category delete confirm state
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

  // Delete item with undo
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

  const isEmpty = !itemsLoading && !itemsError && items.length === 0;

  return (
    <>
      {/* Tab selector — rendered above the ListPage */}
      <div className="mx-auto w-full max-w-screen-md px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={[
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'items'
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {t('stock.tabs.items')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={[
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'categories'
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {t('stock.tabs.categories')}
          </button>
        </div>
      </div>

      {activeTab === 'items' ? (
        <ListPage
          title={t('stock.title')}
          isEmpty={isEmpty}
          emptyState={{
            icon: Package,
            title: t('stock.empty.items'),
            description: t('stock.empty_description'),
            action: { label: t('stock.actions.new_item'), onClick: () => setItemDialogOpen(true) },
          }}
          actions={
            <button
              type="button"
              onClick={() => setItemDialogOpen(true)}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t('stock.actions.new_item')}
            </button>
          }
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

            {itemsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
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
      ) : (
        /* Categories tab — own layout, no ListPage wrapper */
        <div className="mx-auto w-full max-w-screen-md px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold text-slate-900">{t('stock.title')}</h1>
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              }}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t('stock.actions.new_category')}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {categoriesError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

            {categoriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : null}

            {!categoriesLoading && !categoriesError && categories.length === 0 ? (
              <EmptyState
                icon={Tag}
                title={t('stock.empty.categories')}
                description={t('stock.empty_categories_description')}
                action={{
                  label: t('stock.actions.new_category'),
                  onClick: () => {
                    setEditingCategory(null);
                    setCategoryDialogOpen(true);
                  },
                }}
              />
            ) : null}

            {!categoriesLoading && !categoriesError && categories.length > 0 ? (
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
        </div>
      )}

      {/* Item dialogs */}
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

      {/* Category dialogs */}
      <StockCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        existingCategory={editingCategory ?? undefined}
        onSaved={handleSaved}
      />

      {/* Category delete confirm */}
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
