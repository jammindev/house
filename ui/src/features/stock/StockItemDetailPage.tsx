import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Package, Plus, ShoppingCart } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import BackLink from '@/components/BackLink';
import PageHeader from '@/components/PageHeader';
import DetailSection from '@/components/DetailSection';
import InfoField from '@/components/InfoField';
import LoadError from '@/components/LoadError';
import ListSkeleton from '@/components/ListSkeleton';
import { TabShell } from '@/components/TabShell';
import { useNavigateBack } from '@/lib/backNavigation';
import { useDisabledModules } from '@/lib/modules';
import { useAddStockItemToList } from '@/features/shopping/hooks';
import { isPast } from '@/lib/format';
import {
  useStockItem,
  useStockItemHistory,
  useDeleteStockItem,
  stockKeys,
} from './hooks';
import { formatQty, formatDate, formatDateTime, formatAmount, statusVariant } from './format';
import StockItemDialog from './StockItemDialog';
import StockPurchaseDialog from './StockPurchaseDialog';
import StockInventoryDialog from './StockInventoryDialog';
import StockConsumptionTab from './StockConsumptionTab';
import { useDelayedLoading } from '@/lib/useDelayedLoading';

type Tab = 'info' | 'consumption' | 'history';
const TABS: Tab[] = ['info', 'consumption', 'history'];

export default function StockItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/app/stock');
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = React.useState(false);
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [inventoryOpen, setInventoryOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { disabled } = useDisabledModules();
  const addToList = useAddStockItemToList();

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
    return <ListSkeleton className="space-y-2 p-4" />;
  }
  if (isLoading && !item) return null;

  if (error || !item) {
    return (
      <LoadError
        message={t('stock.errors.load_item_failed')}
        link={{ to: '/app/stock', label: t('stock.title') }}
      />
    );
  }

  const expired = isPast(item.expiration_date);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          backLink={<BackLink fallback="/app/stock" fallbackLabel={t('stock.title')} />}
          title={item.name}
          titleSuffix={
            <Badge variant={statusVariant(item.status)} className="text-xs">
              {t(`stock.status.${item.status}`)}
            </Badge>
          }
          description={
            <>
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
            </>
          }
        >
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
          {!disabled.has('shopping') ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 px-3 text-sm"
              onClick={() => addToList.mutate({ stockItemId: item.id })}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {t('shoppingList.fromStock.action')}
            </Button>
          ) : null}
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
        </PageHeader>

        {/* Tabs */}
        <TabShell<Tab>
          tabs={TABS.map((tab) => ({ key: tab, label: t(`stock.detail.tabs.${tab}`) }))}
          sessionKey={`stock-detail.${item.id}.tab`}
          defaultTab="info"
        >
          {(tab) => (
            <>
              {tab === 'info' ? (
                <DetailSection title={t('stock.detail.title')} icon={Package}>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                </DetailSection>
              ) : null}

              {tab === 'consumption' ? (
                <StockConsumptionTab itemId={item.id} unit={item.unit} />
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
                    <ListSkeleton rows={3} rowClassName="h-12" />
                  ) : history.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      {t('stock.detail.no_history')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((entry) => (
                        <li key={entry.id}>
                          <Card
                            className="cursor-pointer p-3 text-sm transition-shadow hover:shadow-md"
                            onClick={() => navigate(`/app/interactions/${entry.id}/edit`)}
                          >
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
                          </Card>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
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
