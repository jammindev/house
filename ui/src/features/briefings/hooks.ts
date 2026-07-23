import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createBriefing,
  deleteBriefing,
  fetchBriefings,
  previewBriefing,
  sendBriefingNow,
  updateBriefing,
  type Briefing,
  type BriefingPayload,
} from '@/lib/api/briefings';
import { toast } from '@/lib/toast';

export const briefingKeys = {
  all: ['briefings'] as const,
  list: () => [...briefingKeys.all, 'list'] as const,
};

export function useBriefings() {
  return useQuery<Briefing[]>({
    queryKey: briefingKeys.list(),
    queryFn: fetchBriefings,
  });
}

export function useCreateBriefing() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: BriefingPayload) => createBriefing(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: briefingKeys.list() });
      toast({ description: t('briefings.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateBriefing() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BriefingPayload> }) =>
      updateBriefing(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: briefingKeys.list() });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBriefing(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: briefingKeys.list() }),
  });
}

export function usePreviewBriefing() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => previewBriefing(id),
    onError: () => toast({ description: t('briefings.preview.failed'), variant: 'destructive' }),
  });
}

export function useSendBriefingNow() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => sendBriefingNow(id),
    onSuccess: (summary) => {
      if (summary.sent > 0) {
        toast({ description: t('briefings.send.sent', { count: summary.sent }), variant: 'success' });
      } else if (summary.skipped_no_telegram > 0) {
        toast({ description: t('briefings.send.noTelegram'), variant: 'destructive' });
      } else {
        toast({ description: t('briefings.send.failed'), variant: 'destructive' });
      }
    },
    onError: () => toast({ description: t('briefings.send.failed'), variant: 'destructive' }),
  });
}
