import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Package, Plus } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import BackLink from '@/components/BackLink';
import { TabShell } from '@/components/TabShell';
import { useNavigateBack } from '@/lib/backNavigation';
import type { StockItemStatus } from '@/lib/api/stock';
import {
  useStockItem,
  useStockItemHistory,
  useDeleteStockItem,
  stockKeys,
} from './hooks';
import { formatQty, formatDate, formatDateTime } from './format';
import StockItemDialog from './StockItemDialog';
import StockPurchaseDialog from './StockPurchaseDialog';
import StockInventoryDialog from './StockInventoryDialog';
import EntityAssistant from '@/features/agent/EntityAssistant';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

function statusVariant(status: StockItemStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'out_of_stock' || status === 'expired') return 'destructive';
  if (status === 'low_stock') return 'secondary';
  if (status === 'ordered' || status === 'reserved') return 'outline';
  return 'default';
}

function isExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatAmount(value?: string | number | null): string {
  if (value == null || value === '') return '—';
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return `${parsed.toFixed(2)} €`;
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-foreground">{children}</dd>
    </div>
  );
}

type Tab = 'info' | 'history' | 'assistant';
const TABS: Tab[] = ['info', 'history', 'assistant'];

export default function StockItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigateBack = useNavigateBack('/app/stock');
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [inventoryOpen, setInventoryOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: item, isLoading, error } = useStockItem(id ?? '');
  const { data: history = [], isLoading: historyLoading } = useStockItemHistory(id ?? '');
  const deleteMutation = useDeleteStockItem();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: stockKeys.all });
    setEditOpen(false);
  }, [qc]);

  const showSkeleton = useDelayedLoading(isLoading && !item);

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => navigateBack(),
    });
  }

  if (!id) return null;

  if (showSkeleton) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (isLoading && !item) return null;

  if (error || !item) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {t('stock.errors.load_item_failed')}
        <Link to="/app/stock" className="ml-2 underline hover:no-underline">
          {t('stock.title')}
        </Link>
      </div>
    );
  }

  const expired = isExpired(item.expiration_date);

  return (
    <>
      <div className="space-y-6">
        {/* Back */}
        <BackLink fallback="/app/stock" fallbackLabel={t('stock.title')} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{item.name}</h1>
              <Badge variant={statusVariant(item.status)} className="text-xs">
                {t(`stock.status.${item.status}`)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.category_name || t('stock.labels.not_available')}
              {item.zone ? (
                <>
                  {' · '}
                  <Link
                    to={`/app/zones/${item.zone}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {item.zone_name ?? item.zone}
                  </Link>
                </>
              ) : (
                ` · ${t('stock.labels.no_zone')}`
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              className="h-8 gap-1 px-3 text-sm"
              onClick={() => setPurchaseOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('stock.purchase.actions.add')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 px-3 text-sm"
              onClick={() => setInventoryOpen(true)}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              {t('stock.inventory.actions.record')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setEditOpen(true)}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-8 px-3 text-sm"
              onClick={() => setDeleteOpen(true)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <TabShell<Tab>
          tabs={TABS.map((tab) => ({ key: tab, label: t(`stock.detail.tabs.${tab}`) }))}
          sessionKey={`stock-detail.${item.id}.tab`}
          defaultTab="info"
        >
          {(tab) => (
            <>
              {tab === 'info' ? (
                <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <h2 className="text-base font-semibold text-foreground">
                      {t('stock.detail.title')}
                    </h2>
                  </div>

                  <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoField label={t('stock.fields.quantity')}>
                      {formatQty(item.quantity, item.unit)}
                    </InfoField>

                    <InfoField label={t('stock.fields.min_max')}>
                      {item.min_quantity || item.max_quantity
                        ? `${item.min_quantity ?? '—'} / ${item.max_quantity ?? '—'}`
                        : '—'}
                    </InfoField>

                    <InfoField label={t('stock.fields.unit_price')}>
                      {formatAmount(item.unit_price)}
                    </InfoField>

                    <InfoField label={t('stock.fields.total_value')}>
                      {formatAmount(item.total_value)}
                    </InfoField>

                    <InfoField label={t('stock.fields.supplier')}>
                      {item.supplier || '—'}
                    </InfoField>

                    <InfoField label={t('stock.fields.purchase_date')}>
                      {formatDate(item.purchase_date)}
                    </InfoField>

                    <InfoField label={t('stock.fields.expiration_date')}>
                      <span className={expired ? 'text-destructive' : undefined}>
                        {formatDate(item.expiration_date)}
                      </span>
                    </InfoField>

                    <InfoField label={t('stock.fields.last_restocked_at')}>
                      {formatDateTime(item.last_restocked_at)}
                    </InfoField>

                    {item.sku ? (
                      <InfoField label={t('stock.fields.sku')}>{item.sku}</InfoField>
                    ) : null}

                    {item.barcode ? (
                      <InfoField label={t('stock.fields.barcode')}>{item.barcode}</InfoField>
                    ) : null}

                    {item.tags.length > 0 ? (
                      <InfoField label={t('stock.fields.tags')}>
                        <span className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      </InfoField>
                    ) : null}
                  </dl>

                  {item.description ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}

                  {item.notes ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.notes}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {tab === 'history' ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">
                      {t('stock.detail.history_title')}
                    </h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPurchaseOpen(true)}
                      className="h-8 gap-1 px-3 text-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('stock.purchase.actions.add')}
                    </Button>
                  </div>

                  {historyLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                      ))}
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      {t('stock.detail.no_history')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((entry) => (
                        <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium">{entry.subject || '—'}</span>
                            {entry.metadata?.amount != null ? (
                              <span className="shrink-0 font-medium">
                                {formatAmount(entry.metadata.amount)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(entry.occurred_at)}
                            {entry.metadata?.delta && entry.metadata?.unit
                              ? ` · +${formatQty(entry.metadata.delta, entry.metadata.unit)}`
                              : ''}
                            {entry.metadata?.brand ? ` · ${entry.metadata.brand}` : ''}
                            {entry.metadata?.supplier ? ` · ${entry.metadata.supplier}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {tab === 'assistant' ? (
                <EntityAssistant entityType="stock_item" objectId={item.id} />
              ) : null}
            </>
          )}
        </TabShell>
      </div>

      <StockItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingItem={item}
        onSaved={handleSaved}
      />

      <StockPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        item={item}
      />

      <StockInventoryDialog
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        item={item}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.confirmDelete')}
        description={t('stock.detail.confirm_delete', { name: item.name })}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
