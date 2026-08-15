import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createHarvest,
  createTree,
  createTreeEvent,
  deleteHarvest,
  deleteTree,
  deleteTreeEvent,
  fetchHarvestSeries,
  fetchHarvests,
  fetchTree,
  fetchTreeEvents,
  fetchTrees,
  updateHarvest,
  updateTree,
  updateTreeEvent,
  type HarvestPayload,
  type TreeEventPayload,
  type TreePayload,
} from '@/lib/api/orchard';
import { useInvalidate } from '@/lib/invalidate';
import { toast } from '@/lib/toast';

export const orchardKeys = {
  all: ['orchard'] as const,
  list: (filters?: { zone?: string; kind?: string; status?: string }) =>
    [...orchardKeys.all, 'list', filters] as const,
  detail: (id: string) => [...orchardKeys.all, 'detail', id] as const,
  events: (filters?: { tree?: string; type?: string }) =>
    [...orchardKeys.all, 'events', filters] as const,
  harvests: (filters?: { tree?: string; season?: number }) =>
    [...orchardKeys.all, 'harvests', filters] as const,
  series: (filters?: { tree?: string; seasons?: number }) =>
    [...orchardKeys.all, 'series', filters] as const,
};

// --- reads ------------------------------------------------------------------

export function useTrees(filters: { zone?: string; kind?: string; status?: string } = {}) {
  return useQuery({
    queryKey: orchardKeys.list(filters),
    queryFn: () => fetchTrees(filters),
  });
}

export function useTree(id: string) {
  return useQuery({
    queryKey: orchardKeys.detail(id),
    queryFn: () => fetchTree(id),
    enabled: Boolean(id),
  });
}

export function useTreeEvents(filters: { tree?: string; type?: string } = {}) {
  return useQuery({
    queryKey: orchardKeys.events(filters),
    queryFn: () => fetchTreeEvents(filters),
  });
}

export function useHarvests(filters: { tree?: string; season?: number } = {}) {
  return useQuery({
    queryKey: orchardKeys.harvests(filters),
    queryFn: () => fetchHarvests(filters),
  });
}

export function useHarvestSeries(filters: { tree?: string; seasons?: number } = {}) {
  return useQuery({
    queryKey: orchardKeys.series(filters),
    queryFn: () => fetchHarvestSeries(filters),
  });
}

// --- writes -----------------------------------------------------------------
//
// Every onSuccess declares the root it **writes** (`orchard`) — never the list of
// caches to refresh. What derives from it is declared once in `DERIVED_FROM`
// (`ui/src/lib/invalidate.ts`), and the closure is transitive.

export function useCreateTree() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: TreePayload) => createTree(payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateTree() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TreePayload> }) =>
      updateTree(id, payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteTree() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteTree(id),
    onSuccess: () => invalidate('orchard'),
  });
}

export function useCreateTreeEvent() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: TreeEventPayload) => createTreeEvent(payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.event.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateTreeEvent() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TreeEventPayload> }) =>
      updateTreeEvent(id, payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.event.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteTreeEvent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteTreeEvent(id),
    onSuccess: () => invalidate('orchard'),
  });
}

export function useCreateHarvest() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: HarvestPayload) => createHarvest(payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.harvest.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateHarvest() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<HarvestPayload> }) =>
      updateHarvest(id, payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.harvest.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteHarvest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteHarvest(id),
    onSuccess: () => invalidate('orchard'),
  });
}
