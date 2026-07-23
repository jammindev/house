import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import type { Briefing } from '@/lib/api/briefings';
import {
  briefingKeys,
  useBriefings,
  useDeleteBriefing,
  useUpdateBriefing,
} from './hooks';
import BriefingCard from './BriefingCard';
import BriefingDialog from './BriefingDialog';

type FilterKey = 'all' | 'active' | 'inactive';

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'briefings.filters.all' },
  { key: 'active', labelKey: 'briefings.filters.active' },
  { key: 'inactive', labelKey: 'briefings.filters.inactive' },
];

export default function BriefingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cacheKey = briefingKeys.list();

  const { data: briefings = [], isLoading } = useBriefings();
  const updateMutation = useUpdateBriefing();
  const deleteMutation = useDeleteBriefing();

  const [filter, setFilter] = useSessionState<FilterKey>('briefings.filter', 'all');
  const [editing, setEditing] = React.useState<Briefing | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const showSkeleton = useDelayedLoading(isLoading);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('briefings.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  const visible = briefings.filter((b) => {
    if (filter === 'active') return b.is_active;
    if (filter === 'inactive') return !b.is_active;
    return true;
  });

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(briefing: Briefing) {
    setEditing(briefing);
    setDialogOpen(true);
  }

  function toggleActive(briefing: Briefing) {
    // Optimistic flip so the toggle feels instant; the mutation reconciles.
    qc.setQueryData<Briefing[]>(cacheKey, (old) =>
      old?.map((b) => (b.id === briefing.id ? { ...b, is_active: !b.is_active } : b)),
    );
    updateMutation.mutate(
      { id: briefing.id, payload: { is_active: !briefing.is_active } },
      { onError: () => void qc.invalidateQueries({ queryKey: cacheKey }) },
    );
  }

  function remove(briefing: Briefing) {
    deleteWithUndo(briefing.id, {
      onRemove: () =>
        qc.setQueryData<Briefing[]>(cacheKey, (old) => old?.filter((b) => b.id !== briefing.id)),
      onRestore: () =>
        qc.setQueryData<Briefing[]>(cacheKey, (old) => (old ? [...old, briefing] : [briefing])),
    });
  }

  return (
    <div>
      <PageHeader title={t('briefings.title')} description={t('briefings.subtitle')}>
        <Button onClick={openCreate} className="gap-1">
          <Plus className="h-4 w-4" />
          {t('briefings.new.button')}
        </Button>
      </PageHeader>

      {!showSkeleton && briefings.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pb-4">
          {FILTERS.map((f) => (
            <FilterPill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {t(f.labelKey)}
            </FilterPill>
          ))}
        </div>
      ) : null}

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <EmptyState
          icon={Send}
          title={t('briefings.empty.title')}
          description={t('briefings.empty.description')}
          action={{ label: t('briefings.new.button'), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((briefing) => (
            <BriefingCard
              key={briefing.id}
              briefing={briefing}
              onEdit={openEdit}
              onDelete={remove}
              onToggleActive={toggleActive}
            />
          ))}
        </div>
      )}

      <BriefingDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
    </div>
  );
}
