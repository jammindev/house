import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  archiveTracker,
  createTracker,
  createTrackerEntry,
  deleteTrackerEntry,
  fetchTracker,
  fetchTrackerEntries,
  fetchTrackers,
  updateTracker,
  updateTrackerEntry,
  type TrackerEntryPayload,
  type TrackerPayload,
} from '@/lib/api/trackers';
import { toast } from '@/lib/toast';

export const trackerKeys = {
  all: ['trackers'] as const,
  list: () => [...trackerKeys.all, 'list'] as const,
  project: (projectId: string) => [...trackerKeys.all, 'project', projectId] as const,
  detail: (id: string) => [...trackerKeys.all, 'detail', id] as const,
  entries: (trackerId: string) => [...trackerKeys.all, trackerId, 'entries'] as const,
};

export function useTrackers(projectId?: string) {
  return useQuery({
    queryKey: projectId ? trackerKeys.project(projectId) : trackerKeys.list(),
    queryFn: () => fetchTrackers({ projectId }),
  });
}

export function useTracker(id: string) {
  return useQuery({
    queryKey: trackerKeys.detail(id),
    queryFn: () => fetchTracker(id),
    enabled: Boolean(id),
  });
}

export function useTrackerEntries(trackerId: string) {
  return useQuery({
    queryKey: trackerKeys.entries(trackerId),
    queryFn: () => fetchTrackerEntries(trackerId),
    enabled: Boolean(trackerId),
  });
}

export function useCreateTracker() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: TrackerPayload) => createTracker(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      toast({ description: t('trackers.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TrackerPayload> }) =>
      updateTracker(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: trackerKeys.all }),
  });
}

export function useArchiveTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveTracker(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: trackerKeys.all }),
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: TrackerEntryPayload) => createTrackerEntry(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      toast({ description: t('trackers.entryAdded'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Omit<TrackerEntryPayload, 'tracker'>>;
    }) => updateTrackerEntry(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: trackerKeys.all }),
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrackerEntry(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: trackerKeys.all }),
  });
}
