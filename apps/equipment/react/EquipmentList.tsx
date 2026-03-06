import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { fetchEquipmentList, type EquipmentListItem } from '@/lib/api/equipment';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface EquipmentListProps {
  title?: string;
  initialSearch?: string;
  initialStatus?: string;
  initialZoneId?: string;
  newUrl?: string;
}

const STATUS_OPTIONS = ['', 'active', 'maintenance', 'storage', 'retired', 'lost', 'ordered'];

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'maintenance') return 'secondary';
  if (status === 'lost') return 'destructive';
  if (status === 'retired' || status === 'storage') return 'outline';
  return 'default';
}

function formatDate(value?: string | null, notAvailableLabel?: string): string {
  if (!value) return notAvailableLabel ?? '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function EquipmentList({
  title,
  initialSearch = '',
  initialStatus = '',
  initialZoneId = '',
  newUrl = '/app/equipment/new/',
}: EquipmentListProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [zones, setZones] = React.useState<ZoneOption[]>([]);
  const [searchDraft, setSearchDraft] = React.useState(initialSearch);
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState(initialStatus);
  const [zone, setZone] = React.useState(initialZoneId);

  const [items, setItems] = React.useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedZones, loadedItems] = await Promise.all([
        fetchZones(householdId),
        fetchEquipmentList({
          householdId,
          search: search || undefined,
          status: status || undefined,
          zone: zone || undefined,
        }),
      ]);
      setZones(loadedZones);
      setItems(loadedItems);
    } catch {
      setError(t('equipment.error_loading_list'));
    } finally {
      setLoading(false);
    }
  }, [householdId, search, status, t, zone]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }

    if (status) {
      url.searchParams.set('status', status);
    } else {
      url.searchParams.delete('status');
    }

    if (zone) {
      url.searchParams.set('zone', zone);
    } else {
      url.searchParams.delete('zone');
    }

    const qs = url.searchParams.toString();
    window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname);
  }, [search, status, zone]);

  function resetFilters() {
    setSearchDraft('');
    setSearch('');
    setStatus('');
    setZone('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title ?? t('equipment.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_220px_auto] md:items-end">
          <div className="space-y-1">
            <label htmlFor="equipment-search" className="text-xs font-medium text-muted-foreground">
              {t('equipment.search')}
            </label>
            <div className="flex gap-2">
              <Input
                id="equipment-search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={t('equipment.search_placeholder')}
              />
              <Button type="button" variant="outline" onClick={() => setSearch(searchDraft.trim())}>
                {t('equipment.apply')}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="equipment-status" className="text-xs font-medium text-muted-foreground">
              {t('equipment.status_label')}
            </label>
            <Select id="equipment-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((entry) => (
                <option key={entry || 'all'} value={entry}>
                  {entry ? t(`equipment.status.${entry}`) : t('equipment.all_statuses')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="equipment-zone" className="text-xs font-medium text-muted-foreground">
              {t('equipment.zone_label')}
            </label>
            <Select id="equipment-zone" value={zone} onChange={(event) => setZone(event.target.value)}>
              <option value="">{t('equipment.all_zones')}</option>
              {zones.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.full_path || entry.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={resetFilters} disabled={!search && !status && !zone}>
              {t('equipment.reset')}
            </Button>
            <a href={newUrl} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              {t('equipment.new')}
            </a>
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">{t('equipment.loading')}</p> : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>{t('equipment.unable_to_load')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('equipment.empty_list')}</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <a href={`/app/equipment/${item.id}/`} className="font-medium text-sm underline">
                      {item.name}
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.category} · {item.manufacturer || t('equipment.unknown_maker')} {item.model || ''}
                    </p>
                  </div>
                  <Badge variant={statusVariant(item.status)}>{t(`equipment.status.${item.status}`)}</Badge>
                </div>

                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <p>
                    {t('equipment.zone')}: {item.zone_name || t('equipment.not_available')}
                  </p>
                  <p>
                    {t('equipment.warranty')}: {formatDate(item.warranty_expires_on, t('equipment.not_available'))}
                  </p>
                  <p>
                    {t('equipment.next_service')}: {formatDate(item.next_service_due, t('equipment.not_available'))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
