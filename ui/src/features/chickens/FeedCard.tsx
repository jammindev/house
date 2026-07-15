import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { pushBack } from '@/lib/backNavigation';
import { fetchStockItems } from '@/lib/api/stock';
import { useStockItem, useStockConsumption } from '@/features/stock/hooks';
import StockPurchaseDialog from '@/features/stock/StockPurchaseDialog';
import { formatQty, formatDate } from '@/features/stock/format';
import { chickenKeys, useChickenSettings, useFlockSummary, useUpdateChickenSettings } from './hooks';

const LOW_STATUSES = ['low_stock', 'out_of_stock'];

/**
 * Feed reserve (US-8): references a stock item — quantity, thresholds and
 * purchases live in the stock module, this card only reads them. When no item
 * is linked yet, it offers to pick one.
 */
export default function FeedCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const qc = useQueryClient();
  const { data: settings } = useChickenSettings();
  const { data: summary } = useFlockSummary();
  const updateSettings = useUpdateChickenSettings();

  const [selecting, setSelecting] = React.useState(false);
  const [itemId, setItemId] = React.useState('');
  const [purchasing, setPurchasing] = React.useState(false);

  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock', 'items', 'for-feed'],
    queryFn: () => fetchStockItems(),
    enabled: selecting,
  });

  const feed = summary?.feed ?? null;
  // Full StockItem for the purchase dialog (the summary only carries a snapshot).
  const { data: feedItem } = useStockItem(feed?.stock_item_id ?? '');
  // Projected depletion date derived from the consumption curve (parcours 18 lot 5).
  const { data: feedConsumption } = useStockConsumption(feed?.stock_item_id ?? '', '90d');

  if (settings && !settings.feed_stock_item) {
    return (
      <Card className="p-4">
        <CardTitle className="text-sm text-muted-foreground">
          {`🌾 ${t('chickens.feed.title')}`}
        </CardTitle>
        {!selecting ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('chickens.feed.not_linked')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelecting(true)}>
              {t('chickens.feed.link_action')}
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="max-w-xs"
              aria-label={t('chickens.feed.pick_item')}
            >
              <option value="">{t('chickens.feed.pick_item')}</option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={!itemId || updateSettings.isPending}
              onClick={() => {
                updateSettings.mutate({ feed_stock_item: itemId });
                setSelecting(false);
              }}
            >
              {t('chickens.feed.link_confirm')}
            </Button>
            {stockItems.length === 0 ? (
              <p className="w-full text-xs text-muted-foreground">
                {t('chickens.feed.no_stock_items')}
              </p>
            ) : null}
          </div>
        )}
      </Card>
    );
  }

  if (!feed) return null;

  const isLow = LOW_STATUSES.includes(feed.status);

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/app/stock/${feed.stock_item_id}`}
            state={pushBack(location)}
            className="group min-w-0 flex-1"
          >
            <CardTitle className="text-sm text-muted-foreground">
              {`🌾 ${t('chickens.feed.title')}`}
            </CardTitle>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatQty(feed.quantity, feed.unit)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="group-hover:underline">{feed.name}</span>
              {' · '}
              <span className={isLow ? 'font-medium text-destructive' : ''}>
                {t(`stock.status.${feed.status}`)}
              </span>
            </p>
            {feedConsumption?.projected_depletion_date ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('chickens.feed.depletion', {
                  date: formatDate(feedConsumption.projected_depletion_date),
                })}
              </p>
            ) : null}
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={() => setPurchasing(true)}>
            {t('chickens.feed.buy')}
          </Button>
        </div>
      </Card>

      <StockPurchaseDialog
        open={purchasing}
        onOpenChange={(open) => {
          setPurchasing(open);
          // The stock purchase invalidates stock keys; refresh the flock
          // summary and settings snapshot too.
          if (!open) void qc.invalidateQueries({ queryKey: chickenKeys.all });
        }}
        item={feedItem ?? null}
      />
    </>
  );
}
