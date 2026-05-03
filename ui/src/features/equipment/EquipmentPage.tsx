import * as React from 'react';
import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import { FilterBar } from '@/design-system/filter-bar';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { EquipmentListItem } from '@/lib/api/equipment';
import { useEquipmentList, useDeleteEquipment, useZones, equipmentKeys } from './hooks';
import EquipmentCard from './EquipmentCard';
import EquipmentDialog from './EquipmentDialog';
import EquipmentPurchaseDialog from './EquipmentPurchaseDialog';

const STATUS_OPTIONS = ['', 'active', 'maintenance', 'storage', 'retired', 'lost', 'ordered'];

export default function EquipmentPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [zone, setZone] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<EquipmentListItem | null>(null);
  const [purchasingItem, setPurchasingItem] = React.useState<EquipmentListItem | null>(null);

  const filters = React.useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(zone ? { zone } : {}),
    }),
    [search, status, zone],
  );

  const { data: items = [], isLoading, error } = useEquipmentList(filters);
  const { data: zones = [] } = useZones();
  const deleteEquipmentMutation = useDeleteEquipment();

  const handleSaved = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: equipmentKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('equipment.deleted'),
    onDelete: (id) => deleteEquipmentMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      deleteWithUndo(itemId, {
        onRemove: () =>
          qc.setQueryData<EquipmentListItem[]>(
            equipmentKeys.list(filters),
            (old) => old?.filter((i) => i.id !== itemId),
          ),
        onRestore: () =>
          qc.setQueryData<EquipmentListItem[]>(
            equipmentKeys.list(filters),
            (old) => (old ? [...old, item] : [item]),
          ),
      });
    },
    [items, deleteWithUndo, qc, filters],
  );

  function resetFilters() {
    setSearch('');
    setStatus('');
    setZone('');
  }

  const isEmpty = !isLoading && !error && items.length === 0;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <>
      <ListPage
        title={t('equipment.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: Wrench,
          title: t('equipment.empty_list'),
          description: t('equipment.empty_description'),
          action: { label: t('equipment.new'), onClick: () => setDialogOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('equipment.new')}
          </button>
        }
      >
        <div className="space-y-4">
          <FilterBar
            fields={[
              {
                type: 'search',
                id: 'equipment-search',
                label: t('equipment.search'),
                value: search,
                onChange: setSearch,
                placeholder: t('equipment.search_placeholder'),
              },
              {
                type: 'select',
                id: 'equipment-status',
                label: t('equipment.status_label'),
                value: status,
                onChange: setStatus,
                options: STATUS_OPTIONS.map((s) => ({
                  value: s,
                  label: s ? t(`equipment.status.${s}`) : t('equipment.all_statuses'),
                })),
              },
              {
                type: 'select',
                id: 'equipment-zone',
                label: t('equipment.zone_label'),
                value: zone,
                onChange: setZone,
                options: [
                  { value: '', label: t('equipment.all_zones') },
                  ...zones.map((z) => ({
                    value: z.id,
                    label: z.full_path || z.name,
                  })),
                ],
              },
            ]}
            onReset={resetFilters}
            hasActiveFilters={!!(search || status || zone)}
            resetLabel={t('equipment.reset')}
            applyLabel={t('equipment.apply')}
          />

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {t('equipment.error_loading_list')}
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: equipmentKeys.all })}
                className="ml-2 underline hover:no-underline"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error ? (
            <ul className="space-y-3">
              {items.map((item) => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  onEdit={setEditingItem}
                  onDelete={handleDelete}
                  onPurchase={setPurchasingItem}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </ListPage>

      <EquipmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />

      <EquipmentDialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        existingItem={editingItem ?? undefined}
        onSaved={handleSaved}
      />

      <EquipmentPurchaseDialog
        open={purchasingItem !== null}
        onOpenChange={(open) => { if (!open) setPurchasingItem(null); }}
        equipment={purchasingItem}
      />
    </>
  );
}
