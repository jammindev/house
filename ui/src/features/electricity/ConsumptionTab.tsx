import * as React from 'react';
import { ChevronLeft, ChevronRight, Gauge, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { Card } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { Select } from '@/design-system/select';
import CardActions, { type CardAction } from '@/components/CardActions';
import EmptyState from '@/components/EmptyState';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import type { ElectricityMeter, Granularity, MeterReading } from '@/lib/api/electricity';
import { useQueryClient } from '@tanstack/react-query';
import {
  consumptionKeys,
  useConsumptionSummary,
  useDeleteMeter,
  useDeleteMeterReading,
  useMeterReadings,
  useMeters,
} from './hooks';
import ConsumptionChart from './ConsumptionChart';
import ImportDialog from './ImportDialog';
import MeterDialog from './MeterDialog';
import ReadingDialog from './ReadingDialog';

const GRANULARITIES: Granularity[] = ['hour', 'day', 'month', 'year'];

// ── Period window: an anchor date + a granularity define [date_from, date_to] ──

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function periodRange(anchor: Date, granularity: Granularity): { from: string; to: string } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  switch (granularity) {
    case 'hour': // one day, hour by hour
      return { from: isoDate(anchor), to: isoDate(anchor) };
    case 'day': // one month, day by day
      return { from: isoDate(new Date(year, month, 1)), to: isoDate(new Date(year, month + 1, 0)) };
    case 'month': // one year, month by month
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case 'year': // a decade, year by year
      return { from: `${year - 9}-01-01`, to: `${year}-12-31` };
  }
}

function shiftAnchor(anchor: Date, granularity: Granularity, direction: 1 | -1): Date {
  const next = new Date(anchor);
  switch (granularity) {
    case 'hour':
      next.setDate(next.getDate() + direction);
      break;
    case 'day':
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
      break;
    case 'month':
    case 'year':
      next.setFullYear(next.getFullYear() + direction);
      break;
  }
  return next;
}

function periodLabel(anchor: Date, granularity: Granularity, locale: string): string {
  switch (granularity) {
    case 'hour':
      return anchor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'day':
      return anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'month':
      return String(anchor.getFullYear());
    case 'year':
      return `${anchor.getFullYear() - 9} – ${anchor.getFullYear()}`;
  }
}

function formatKwh(wh: number): string {
  return (wh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ── Readings list ─────────────────────────────────────────────────────────────

interface ReadingRowProps {
  reading: MeterReading;
  locale: string;
  registerLabel: (r: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

function ReadingRow({ reading, locale, registerLabel, onEdit, onDelete, t }: ReadingRowProps) {
  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];
  const date = new Date(reading.reading_at);
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
            {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Badge variant="outline" className="text-xs">{registerLabel(reading.register)}</Badge>
          <span className="font-medium">{Number(reading.index_kwh).toLocaleString(locale)} kWh</span>
        </div>
        <CardActions actions={actions} />
      </div>
    </Card>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ConsumptionTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const qc = useQueryClient();

  const { data: meters = [], isLoading: metersLoading } = useMeters();
  const [selectedMeterId, setSelectedMeterId] = useSessionState<string>('electricity.consumption.meter', '');
  const [granularity, setGranularity] = useSessionState<Granularity>('electricity.consumption.granularity', 'day');
  const [anchorIso, setAnchorIso] = useSessionState<string>('electricity.consumption.anchor', isoDate(new Date()));

  const meter: ElectricityMeter | undefined =
    meters.find((m) => m.id === selectedMeterId) ?? meters[0];

  React.useEffect(() => {
    if (meter && meter.id !== selectedMeterId) setSelectedMeterId(meter.id);
  }, [meter, selectedMeterId, setSelectedMeterId]);

  const anchor = React.useMemo(() => new Date(`${anchorIso}T00:00:00`), [anchorIso]);
  const { from, to } = periodRange(anchor, granularity);

  const { data: summary, isLoading: summaryLoading } = useConsumptionSummary({
    meter: meter?.id ?? '',
    granularity,
    date_from: from,
    date_to: to,
  });
  const { data: readings = [] } = useMeterReadings(meter?.id);

  const [meterDialogOpen, setMeterDialogOpen] = React.useState(false);
  const [editingMeter, setEditingMeter] = React.useState<ElectricityMeter | undefined>(undefined);
  const [readingDialogOpen, setReadingDialogOpen] = React.useState(false);
  const [editingReading, setEditingReading] = React.useState<MeterReading | undefined>(undefined);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);

  const deleteMeter = useDeleteMeter();
  const deleteReading = useDeleteMeterReading();
  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('electricity.reading.deleted'),
    onDelete: (id: string) => deleteReading.mutateAsync(id),
  });

  const registerLabel = React.useCallback(
    (register: string) => t(`electricity.consumption.register.${register}`),
    [t],
  );

  const showSkeleton = useDelayedLoading(metersLoading);
  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!metersLoading && meters.length === 0) {
    return (
      <>
        <EmptyState
          icon={Gauge}
          title={t('electricity.meter.emptyTitle')}
          description={t('electricity.meter.emptyDescription')}
          action={{
            label: t('electricity.meter.new'),
            onClick: () => { setEditingMeter(undefined); setMeterDialogOpen(true); },
          }}
        />
        <MeterDialog open={meterDialogOpen} onOpenChange={setMeterDialogOpen} existing={editingMeter} />
      </>
    );
  }

  if (!meter) return null;

  const meterActions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => { setEditingMeter(meter); setMeterDialogOpen(true); } },
    {
      label: t('common.delete'),
      icon: Trash2,
      onClick: () => deleteMeter.mutate(meter.id),
      variant: 'danger',
    },
  ];

  const hasData = (summary?.buckets.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Meter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {meters.length > 1 ? (
            <Select
              value={meter.id}
              onChange={(e) => setSelectedMeterId(e.target.value)}
              options={meters.map((m) => ({ value: m.id, label: m.name }))}
              className="max-w-52"
              aria-label={t('electricity.meter.selectLabel')}
            />
          ) : (
            <span className="truncate text-sm font-medium">{meter.name}</span>
          )}
          <Badge variant="outline" className="text-xs">
            {meter.tariff_type === 'hp_hc'
              ? t('electricity.meter.tariffHpHc')
              : t('electricity.consumption.register.base')}
          </Badge>
          <CardActions actions={meterActions} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditingReading(undefined); setReadingDialogOpen(true); }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('electricity.reading.new')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            {t('electricity.import.button')}
          </Button>
        </div>
      </div>

      {/* Granularity + period navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {GRANULARITIES.map((g) => (
            <FilterPill key={g} active={granularity === g} onClick={() => setGranularity(g)}>
              {t(`electricity.consumption.granularity.${g}`)}
            </FilterPill>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('electricity.consumption.previousPeriod')}
            onClick={() => setAnchorIso(isoDate(shiftAnchor(anchor, granularity, -1)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm capitalize">{periodLabel(anchor, granularity, locale)}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('electricity.consumption.nextPeriod')}
            onClick={() => setAnchorIso(isoDate(shiftAnchor(anchor, granularity, 1)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
          <p className="text-lg font-semibold">
            {formatKwh(summary?.total_wh ?? 0)} kWh
            <span className="pl-1.5 text-sm font-normal text-muted-foreground">
              {t('electricity.consumption.overPeriod')}
            </span>
          </p>
          {summary && summary.estimated_wh > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('electricity.consumption.estimatedShare', { kwh: formatKwh(summary.estimated_wh) })}
            </p>
          ) : null}
        </div>
        {summaryLoading && !summary ? (
          <div className="h-64 animate-pulse rounded-lg bg-muted sm:h-80" />
        ) : hasData && summary ? (
          <ConsumptionChart summary={summary} granularity={granularity} />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground sm:h-80">
            {granularity === 'hour'
              ? t('electricity.consumption.noHourlyData')
              : t('electricity.consumption.noData')}
          </div>
        )}
      </Card>

      {/* Recent readings */}
      {readings.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('electricity.reading.recentTitle')}
          </h3>
          {readings.slice(0, 8).map((reading) => (
            <ReadingRow
              key={reading.id}
              reading={reading}
              locale={locale}
              registerLabel={registerLabel}
              onEdit={() => { setEditingReading(reading); setReadingDialogOpen(true); }}
              onDelete={() => {
                deleteWithUndo(reading.id, {
                  onRemove: () => qc.setQueryData<MeterReading[]>(
                    consumptionKeys.readings(meter.id),
                    (old) => old?.filter((r) => r.id !== reading.id),
                  ),
                  onRestore: () => qc.setQueryData<MeterReading[]>(
                    consumptionKeys.readings(meter.id),
                    (old) => (old ? [...old, reading] : [reading]),
                  ),
                });
              }}
              t={t}
            />
          ))}
        </div>
      ) : null}

      <MeterDialog open={meterDialogOpen} onOpenChange={setMeterDialogOpen} existing={editingMeter} />
      <ReadingDialog
        open={readingDialogOpen}
        onOpenChange={setReadingDialogOpen}
        meter={meter}
        existing={editingReading}
      />
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} meter={meter} />
    </div>
  );
}
