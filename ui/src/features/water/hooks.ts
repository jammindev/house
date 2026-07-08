import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  createWaterReading,
  deleteWaterReading,
  fetchWaterConsumptionSummary,
  fetchWaterReadings,
  updateWaterReading,
  type WaterGranularity,
  type WaterReadingPayload,
} from '@/lib/api/water';

// ── Query key factory ─────────────────────────────────────────────────────────

export const waterKeys = {
  all: ['water'] as const,
  readings: () => [...waterKeys.all, 'readings'] as const,
  summary: (params: { granularity: string; date_from: string; date_to: string }) =>
    [...waterKeys.all, 'summary', params] as const,
};

// ── Query hooks ───────────────────────────────────────────────────────────────

export function useWaterReadings() {
  return useQuery({
    queryKey: waterKeys.readings(),
    queryFn: fetchWaterReadings,
  });
}

export function useWaterConsumptionSummary({
  enabled = true,
  ...params
}: {
  granularity: WaterGranularity;
  date_from: string;
  date_to: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: waterKeys.summary(params),
    queryFn: () => fetchWaterConsumptionSummary(params),
    placeholderData: (prev) => prev,
    enabled,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function invalidateWater(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: waterKeys.all });
}

export function useCreateWaterReading() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: WaterReadingPayload) => createWaterReading(payload),
    onSuccess: () => {
      invalidateWater(qc);
      toast({ description: t('water.reading.created'), variant: 'success' });
    },
  });
}

export function useUpdateWaterReading() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WaterReadingPayload> }) =>
      updateWaterReading(id, payload),
    onSuccess: () => {
      invalidateWater(qc);
      toast({ description: t('water.reading.updated'), variant: 'success' });
    },
  });
}

export function useDeleteWaterReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWaterReading(id),
    onSuccess: () => invalidateWater(qc),
  });
}
