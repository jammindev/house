import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createChicken,
  createChickenEvent,
  deleteChicken,
  deleteChickenEvent,
  deleteEggLog,
  fetchChicken,
  fetchChickenEvents,
  fetchChickens,
  fetchChickenSettings,
  fetchEggLogs,
  fetchEggStats,
  fetchFlockSummary,
  logEggs,
  purchaseChicken,
  updateChicken,
  updateChickenEvent,
  updateChickenSettings,
  type Chicken,
  type ChickenEvent,
  type ChickenEventPayload,
  type ChickenPayload,
  type ChickenPurchasePayload,
} from '@/lib/api/chickens';
import { toast } from '@/lib/toast';

export const chickenKeys = {
  all: ['chickens'] as const,
  list: (filters?: { status?: string; in_flock?: boolean }) =>
    [...chickenKeys.all, 'list', filters] as const,
  detail: (id: string) => [...chickenKeys.all, 'detail', id] as const,
  eggLogs: () => [...chickenKeys.all, 'egg-logs'] as const,
  eggStats: () => [...chickenKeys.all, 'egg-stats'] as const,
  events: (filters?: { chicken?: string }) => [...chickenKeys.all, 'events', filters] as const,
  settings: () => [...chickenKeys.all, 'settings'] as const,
  summary: () => [...chickenKeys.all, 'summary'] as const,
};

export function useChickens(filters: { status?: string; in_flock?: boolean } = {}) {
  return useQuery({
    queryKey: chickenKeys.list(filters),
    queryFn: () => fetchChickens(filters),
  });
}

export function useChicken(id: string) {
  return useQuery({
    queryKey: chickenKeys.detail(id),
    queryFn: () => fetchChicken(id),
    enabled: Boolean(id),
  });
}

export function useEggLogs(filters: { date_from?: string; date_to?: string } = {}) {
  return useQuery({
    queryKey: [...chickenKeys.eggLogs(), filters],
    queryFn: () => fetchEggLogs(filters),
  });
}

export function useEggStats() {
  return useQuery({
    queryKey: chickenKeys.eggStats(),
    queryFn: fetchEggStats,
  });
}

export function useChickenEvents(filters: { chicken?: string } = {}) {
  return useQuery({
    queryKey: chickenKeys.events(filters),
    queryFn: () => fetchChickenEvents(filters),
  });
}

export function useChickenSettings() {
  return useQuery({
    queryKey: chickenKeys.settings(),
    queryFn: fetchChickenSettings,
  });
}

export function useFlockSummary() {
  return useQuery({
    queryKey: chickenKeys.summary(),
    queryFn: fetchFlockSummary,
  });
}

export function useCreateChicken() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ChickenPayload) => createChicken(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      toast({ description: t('chickens.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateChicken() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ChickenPayload> }) =>
      updateChicken(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      toast({ description: t('chickens.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteChicken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChicken(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chickenKeys.all }),
  });
}

export function usePurchaseChicken() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChickenPurchasePayload }) =>
      purchaseChicken(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      void qc.invalidateQueries({ queryKey: ['interactions'] });
      toast({ description: t('chickens.purchase.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useLogEggs() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: { date: string; count: number; note?: string }) => logEggs(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      toast({ description: t('chickens.eggs.logged'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteEggLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEggLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chickenKeys.all }),
  });
}

export function useCreateChickenEvent() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ChickenEventPayload) => createChickenEvent(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      // A reminder may have created a task
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ description: t('chickens.events.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateChickenEvent() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ChickenEventPayload> }) =>
      updateChickenEvent(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      toast({ description: t('chickens.events.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteChickenEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChickenEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chickenKeys.all }),
  });
}

export function useUpdateChickenSettings() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: { feed_tracker: string | null }) => updateChickenSettings(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chickenKeys.all });
      toast({ description: t('chickens.feed.linked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export type { Chicken, ChickenEvent };
