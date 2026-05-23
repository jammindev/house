import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import { FilterBar } from '@/design-system/filter-bar';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { InsuranceContract } from '@/lib/api/insurance';
import { useInsuranceList, useDeleteInsurance, insuranceKeys } from './hooks';
import InsuranceCard from './InsuranceCard';
import InsuranceDialog from './InsuranceDialog';

const TYPE_OPTIONS = ['health', 'home', 'car', 'life', 'liability', 'other'];
const STATUS_OPTIONS = ['active', 'suspended', 'terminated'];

export default function InsurancePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState('');
  const [status, setStatus] = React.useState('');

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InsuranceContract | null>(null);

  const filters = React.useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    }),
    [search, type, status],
  );

  const { data: items = [], isLoading, error } = useInsuranceList(filters);
  const deleteMutation = useDeleteInsurance();

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('insurance.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      deleteWithUndo(id, {
        onRemove: () =>
          qc.setQueryData<InsuranceContract[]>(
            insuranceKeys.list(filters),
            (old) => old?.filter((i) => i.id !== id),
          ),
        onRestore: () =>
          qc.setQueryData<InsuranceContract[]>(
            insuranceKeys.list(filters),
            (old) => (old ? [...old, item] : [item]),
          ),
      });
    },
    [items, deleteWithUndo, qc, filters],
  );

  function resetFilters() {
    setSearch('');
    setType('');
    setStatus('');
  }

  const isEmpty = !isLoading && !error && items.length === 0;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <>
      <ListPage
        title={t('insurance.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: ShieldCheck,
          title: t('insurance.empty'),
          description: t('insurance.empty_description'),
          action: { label: t('insurance.new'), onClick: () => setDialogOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('insurance.new')}
          </button>
        }
      >
        <div className="space-y-4">
          <FilterBar
            fields={[
              {
                type: 'search',
                id: 'insurance-filter-search',
                label: t('insurance.search_label'),
                value: search,
                onChange: setSearch,
                placeholder: t('insurance.search_placeholder'),
              },
              {
                type: 'select',
                id: 'insurance-filter-type',
                label: t('insurance.field.type'),
                value: type,
                onChange: setType,
                options: [
                  { value: '', label: t('insurance.all_types') },
                  ...TYPE_OPTIONS.map((v) => ({ value: v, label: t(`insurance.type.${v}`) })),
                ],
              },
              {
                type: 'select',
                id: 'insurance-filter-status',
                label: t('insurance.field.status'),
                value: status,
                onChange: setStatus,
                options: [
                  { value: '', label: t('insurance.all_statuses') },
                  ...STATUS_OPTIONS.map((v) => ({ value: v, label: t(`insurance.status.${v}`) })),
                ],
              },
            ]}
            onReset={resetFilters}
            hasActiveFilters={!!(search || type || status)}
            resetLabel={t('insurance.reset_filters')}
            applyLabel={t('insurance.apply_filters')}
          />

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {t('insurance.load_failed')}
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: insuranceKeys.all })}
                className="ml-2 underline hover:no-underline"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error ? (
            <div className="space-y-2">
              {items.map((contract) => (
                <InsuranceCard
                  key={contract.id}
                  contract={contract}
                  onEdit={(c) => {
                    setEditing(c);
                    setDialogOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : null}
        </div>
      </ListPage>

      <InsuranceDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        existing={editing ?? undefined}
        onSaved={() => qc.invalidateQueries({ queryKey: insuranceKeys.all })}
      />
    </>
  );
}
