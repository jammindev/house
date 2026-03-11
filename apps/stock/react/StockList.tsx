import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design-system/dialog';
import { FilterBar } from '@/design-system/filter-bar';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import {
  createStockCategory,
  deleteStockCategory,
  fetchStockCategories,
  fetchStockCategorySummary,
  fetchStockItems,
  updateStockCategory,
  type StockCategory,
  type StockCategorySummary,
  type StockItem,
} from '@/lib/api/stock';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';
import { useHouseholdId } from '@/lib/useHouseholdId';
import PageHeader from '@/components/PageHeader';

interface StockListProps {
  initialSearch?: string;
  initialStatus?: string;
  initialZoneId?: string;
  initialCategoryId?: string;
  newUrl?: string;
}

const STATUS_OPTIONS = ['', 'in_stock', 'low_stock', 'out_of_stock', 'ordered', 'expired', 'reserved'];

function formatQty(qty: string, unit: string) {
  const parsed = Number(qty);
  if (Number.isNaN(parsed)) return `${qty} ${unit}`;
  return `${parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(3).replace(/\.?0+$/, '')} ${unit}`;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'out_of_stock' || status === 'expired') return 'destructive';
  if (status === 'low_stock') return 'secondary';
  if (status === 'ordered' || status === 'reserved') return 'outline';
  return 'default';
}

export default function StockList({
  initialSearch = '',
  initialStatus = '',
  initialZoneId = '',
  initialCategoryId = '',
  newUrl = '/app/stock/new/',
}: StockListProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<'items' | 'categories'>('items');

  const [zones, setZones] = React.useState<ZoneOption[]>([]);
  const [categories, setCategories] = React.useState<StockCategory[]>([]);
  const [summary, setSummary] = React.useState<StockCategorySummary[]>([]);
  const [items, setItems] = React.useState<StockItem[]>([]);

  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState(initialStatus);
  const [zone, setZone] = React.useState(initialZoneId);
  const [category, setCategory] = React.useState(initialCategoryId);
  const [createCategoryRequested, setCreateCategoryRequested] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<StockCategory | null>(null);
  const [categorySaving, setCategorySaving] = React.useState(false);
  const [categoryForm, setCategoryForm] = React.useState({
    name: '',
    emoji: '📦',
    color: '#94a3b8',
    description: '',
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedZones, loadedCategories, loadedSummary, loadedItems] = await Promise.all([
        fetchZones(householdId),
        fetchStockCategories(householdId),
        fetchStockCategorySummary(householdId),
        fetchStockItems({
          householdId,
          search: search || undefined,
          status: status || undefined,
          zone: zone || undefined,
          category: category || undefined,
        }),
      ]);
      setZones(loadedZones);
      setCategories(loadedCategories);
      setSummary(loadedSummary);
      setItems(loadedItems);
    } catch {
      setError(t('stock.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [householdId, search, status, zone, category, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (search) url.searchParams.set('search', search); else url.searchParams.delete('search');
    if (status) url.searchParams.set('status', status); else url.searchParams.delete('status');
    if (zone) url.searchParams.set('zone', zone); else url.searchParams.delete('zone');
    if (category) url.searchParams.set('category', category); else url.searchParams.delete('category');

    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
  }, [search, status, zone, category]);

  React.useEffect(() => {
    if (!createCategoryRequested) return;
    setTab('categories');
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      emoji: '📦',
      color: '#94a3b8',
      description: '',
    });
    setCategoryDialogOpen(true);
  }, [createCategoryRequested]);

  function handleCategoryDialogOpenChange(open: boolean) {
    setCategoryDialogOpen(open);
    if (!open) {
      setCreateCategoryRequested(false);
    }
  }

  function openEditCategoryDialog(entry: StockCategory) {
    setEditingCategory(entry);
    setCategoryForm({
      name: entry.name,
      emoji: entry.emoji,
      color: entry.color,
      description: entry.description,
    });
    setCategoryDialogOpen(true);
  }

  async function handleSaveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryForm.name.trim()) return;

    setCategorySaving(true);
    try {
      if (editingCategory) {
        await updateStockCategory(
          editingCategory.id,
          {
            name: categoryForm.name.trim(),
            emoji: categoryForm.emoji.trim() || '📦',
            color: categoryForm.color.trim() || '#94a3b8',
            description: categoryForm.description.trim(),
          },
          householdId
        );
      } else {
        await createStockCategory(
          {
            name: categoryForm.name.trim(),
            emoji: categoryForm.emoji.trim() || '📦',
            color: categoryForm.color.trim() || '#94a3b8',
            description: categoryForm.description.trim(),
            sort_order: categories.length,
          },
          householdId
        );
      }

      setCategoryDialogOpen(false);
      setCreateCategoryRequested(false);
      await load();
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleDeleteCategory(entry: StockCategory) {
    if (!window.confirm(t('stock.categories.confirm_delete', { name: entry.name }))) return;
    await deleteStockCategory(entry.id, householdId);
    await load();
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setZone('');
    setCategory('');
  }

  const hasActiveFilters = !!(search || status || zone || category);

  return (
    <div className="space-y-4">
      <PageHeader title={t('stock.title', { defaultValue: 'Stock' })}>
        <button
          type="button"
          onClick={() => { setTab('categories'); setCreateCategoryRequested(true); }}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t('stock.actions.new_category', { defaultValue: 'New category' })}
        </button>
        <a
          href={newUrl}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t('stock.actions.new_item', { defaultValue: 'New item' })}
        </a>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant={tab === 'items' ? 'default' : 'outline'} onClick={() => setTab('items')}>
              {t('stock.tabs.items')}
            </Button>
            <Button type="button" variant={tab === 'categories' ? 'default' : 'outline'} onClick={() => setTab('categories')}>
              {t('stock.tabs.categories')}
            </Button>
          </div>
      </div>

      <div className="space-y-4">
        {tab === 'items' ? (
          <>
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
                  options: STATUS_OPTIONS.map((entry) => ({
                    value: entry,
                    label: entry ? t(`stock.status.${entry}`) : t('stock.fields.all_statuses'),
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
                    ...zones.map((entry) => ({
                      value: entry.id,
                      label: entry.full_path || entry.name,
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
                    ...categories.map((entry) => ({
                      value: entry.id,
                      label: `${entry.emoji} ${entry.name}`,
                    })),
                  ],
                },
              ]}
              onReset={resetFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {loading ? <p className="text-sm text-muted-foreground">{t('stock.loading.items')}</p> : null}

            {!loading && error ? (
              <Alert variant="destructive">
                <AlertTitle>{t('stock.errors.title')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('stock.empty.items')}</p>
            ) : null}

            {!loading && !error && items.length > 0 ? (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <a href={`/app/stock/${item.id}/`} className="font-medium text-sm underline">{item.name}</a>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.category_name || t('stock.labels.not_available')} · {item.zone_name || t('stock.labels.no_zone')}
                        </p>
                      </div>
                      <Badge variant={statusVariant(item.status)}>{t(`stock.status.${item.status}`)}</Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <p>{t('stock.fields.quantity')}: {formatQty(item.quantity, item.unit)}</p>
                      <p>{t('stock.fields.sku')}: {item.sku || t('stock.labels.not_available')}</p>
                      <p>{t('stock.fields.supplier')}: {item.supplier || t('stock.labels.not_available')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {tab === 'categories' ? (
          <>
            {loading ? <p className="text-sm text-muted-foreground">{t('stock.loading.categories')}</p> : null}

            {!loading && categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('stock.empty.categories')}</p>
            ) : null}

            {!loading && categories.length > 0 ? (
              <ul className="space-y-3">
                {categories.map((entry) => {
                  const categorySummary = summary.find((item) => item.category_id === entry.id);
                  return (
                    <li key={entry.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{entry.emoji} {entry.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.description || t('stock.labels.no_description')}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => openEditCategoryDialog(entry)}>{t('stock.actions.edit')}</Button>
                          <Button type="button" variant="destructive" onClick={() => handleDeleteCategory(entry)}>{t('stock.actions.delete')}</Button>
                        </div>
                      </div>
                      {categorySummary ? (
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                          <p>{t('stock.categories.items_count')}: {categorySummary.item_count}</p>
                          <p>{t('stock.categories.low_stock_count')}: {categorySummary.low_stock_count}</p>
                          <p>{t('stock.categories.out_of_stock_count')}: {categorySummary.out_of_stock_count}</p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        ) : null}

        <Dialog open={categoryDialogOpen} onOpenChange={handleCategoryDialogOpenChange}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? t('stock.categories.edit_title') : t('stock.categories.create_title')}
              </DialogTitle>
            </DialogHeader>

            <form className="space-y-3" onSubmit={handleSaveCategory}>
              <div className="space-y-1">
                <label htmlFor="category-name" className="text-sm font-medium">{t('stock.fields.name')}</label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="category-emoji" className="text-sm font-medium">{t('stock.fields.emoji')}</label>
                  <Input
                    id="category-emoji"
                    value={categoryForm.emoji}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, emoji: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="category-color" className="text-sm font-medium">{t('stock.fields.color')}</label>
                  <Input
                    id="category-color"
                    type="text"
                    value={categoryForm.color}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, color: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="category-description" className="text-sm font-medium">{t('stock.fields.description')}</label>
                <Textarea
                  id="category-description"
                  rows={3}
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleCategoryDialogOpenChange(false)}>
                  {t('stock.actions.cancel')}
                </Button>
                <Button type="submit" disabled={categorySaving}>
                  {categorySaving ? t('stock.actions.saving') : t('stock.actions.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
