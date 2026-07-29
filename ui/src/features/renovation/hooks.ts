import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { useInvalidate } from '@/lib/invalidate';
import { deleteInteraction, fetchInteractions } from '@/lib/api/interactions';
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

/**
 * Une entrée du carnet **est** une `Interaction` attachée à des zones : c'est
 * cette racine qu'on déclare, et le graphe (`lib/invalidate`) en déduit le reste
 * — activité de la zone, journal, dashboard.
 */
function useInvalidateRenovation() {
  const invalidate = useInvalidate();
  return () => invalidate('renovation', 'interactions');
}

export function useCreateRenovation() {
  const invalidateRenovation = useInvalidateRenovation();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: RenovationCreateInput) => createRenovation(payload),
    onSuccess: () => {
      invalidateRenovation();
      toast({ description: t('renovation.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateRenovation() {
  const invalidateRenovation = useInvalidateRenovation();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RenovationUpdateInput }) =>
      updateRenovation(id, payload),
    onSuccess: () => {
      invalidateRenovation();
      toast({ description: t('renovation.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Mutation nue — l'onglet l'emballe dans `useDeleteWithUndo`. */
export function useDeleteRenovation() {
  const invalidateRenovation = useInvalidateRenovation();
  return useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: invalidateRenovation,
  });
}
