import { useQuery } from '@tanstack/react-query';
import {
  fetchAIUsageHistogram,
  fetchAIUsageRecent,
  fetchAIUsageSummary,
} from '@/lib/api/ai-usage';
import { useHouseholdList } from '@/lib/modules';

export const aiUsageKeys = {
  all: ['ai-usage'] as const,
  summary: () => [...aiUsageKeys.all, 'summary'] as const,
  histogram: (days: number) => [...aiUsageKeys.all, 'histogram', days] as const,
  recent: (feature: string | null) => [...aiUsageKeys.all, 'recent', feature] as const,
};

export function useAIUsageSummary() {
  return useQuery({
    queryKey: aiUsageKeys.summary(),
    queryFn: fetchAIUsageSummary,
  });
}

export function useAIUsageHistogram(days = 30) {
  return useQuery({
    queryKey: aiUsageKeys.histogram(days),
    queryFn: () => fetchAIUsageHistogram(days),
  });
}

export function useAIUsageRecent(feature: string | null) {
  return useQuery({
    queryKey: aiUsageKeys.recent(feature),
    queryFn: () => fetchAIUsageRecent(feature ?? undefined),
  });
}

/**
 * True when the current user owns the active household — gates the sidebar
 * entry and the page content (the API enforces it anyway, this is UX).
 * `undefined` while loading.
 */
export function useIsHouseholdOwner(): boolean | undefined {
  const { active, isLoading } = useHouseholdList();
  if (isLoading) return undefined;
  return active?.current_user_role === 'owner';
}
