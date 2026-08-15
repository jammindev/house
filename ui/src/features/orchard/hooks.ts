import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  completeCareRule,
  createCareRule,
  createCareTask,
  createHarvest,
  createTree,
  createTreeEvent,
  deleteCareRule,
  deleteHarvest,
  deleteTree,
  deleteTreeEvent,
  fetchCareRules,
  fetchHarvestSeries,
  fetchHarvests,
  fetchSeasonPanel,
  fetchTree,
  fetchTreeEvents,
  fetchTrees,
  purchaseTree,
  updateCareRule,
  updateHarvest,
  updateTree,
  updateTreeEvent,
  type CareRulePayload,
  type TreePurchasePayload,
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
  rules: () => [...orchardKeys.all, 'rules'] as const,
  season: () => [...orchardKeys.all, 'season'] as const,
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

// --- seasonal care rules ------------------------------------------------------

export function useCareRules() {
  return useQuery({ queryKey: orchardKeys.rules(), queryFn: fetchCareRules });
}

export function useSeasonPanel() {
  return useQuery({ queryKey: orchardKeys.season(), queryFn: fetchSeasonPanel });
}

export function useCreateCareRule() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CareRulePayload) => createCareRule(payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.care.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateCareRule() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CareRulePayload> }) =>
      updateCareRule(id, payload),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.care.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteCareRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteCareRule(id),
    onSuccess: () => invalidate('orchard'),
  });
}

export function useCompleteCareRule() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, tree, occurredOn }: { id: string; tree: string; occurredOn?: string }) =>
      completeCareRule(id, { tree, occurred_on: occurredOn }),
    onSuccess: () => {
      invalidate('orchard');
      toast({ description: t('orchard.care.completed'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useCreateCareTask() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, tree }: { id: string; tree: string }) => createCareTask(id, { tree }),
    onSuccess: () => {
      // Writes a Task, not an orchard row — the reminder lives in the tasks
      // module, which is exactly the point of not inventing a fourth one.
      invalidate('tasks');
      toast({ description: t('orchard.care.taskCreated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function usePurchaseTree() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TreePurchasePayload }) =>
      purchaseTree(id, payload),
    onSuccess: () => {
      // Two roots written: the subject's cost, and the household's money.
      invalidate('orchard');
      invalidate('interactions');
      toast({ description: t('orchard.purchase.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
