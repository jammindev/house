import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { fetchInteractions } from '@/lib/api/interactions';
import {
  createRenovation,
  updateRenovation,
  type RenovationCreateInput,
  type RenovationUpdateInput,
} from '@/lib/api/renovation';

export const renovationKeys = {
  all: ['renovation'] as const,
  byZone: (zoneId: string) => [...renovationKeys.all, 'zone', zoneId] as const,
};

/** All renovation-log entries attached to a zone (kind=renovation), newest first. */
export function useRenovationEntries(zoneId: string) {
  return useQuery({
    queryKey: renovationKeys.byZone(zoneId),
    queryFn: () => fetchInteractions({ zone: zoneId, kind: 'renovation', limit: 100 }),
    enabled: !!zoneId,
  });
}

function invalidateRenovation(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: renovationKeys.all });
  // An entry is an Interaction attached to zones — refresh zone activity + lists.
  void qc.invalidateQueries({ queryKey: ['zones'] });
  void qc.invalidateQueries({ queryKey: ['interactions'] });
}

export function useCreateRenovation() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: RenovationCreateInput) => createRenovation(payload),
    onSuccess: () => {
      invalidateRenovation(qc);
      toast({ description: t('renovation.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateRenovation() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RenovationUpdateInput }) =>
      updateRenovation(id, payload),
    onSuccess: () => {
      invalidateRenovation(qc);
      toast({ description: t('renovation.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
