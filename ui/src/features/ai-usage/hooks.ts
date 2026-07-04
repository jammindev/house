import { useQuery } from '@tanstack/react-query';
import {
  fetchAIUsageHistogram,
  fetchAIUsageRecent,
  fetchAIUsageSummary,
} from '@/lib/api/ai-usage';
import { fetchHouseholds } from '@/lib/api/households';
import { useAuth } from '@/lib/auth/useAuth';

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
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['households', 'list'],
    queryFn: fetchHouseholds,
    staleTime: 60_000,
  });
  if (!query.data) return undefined;
  const active =
    (user?.active_household
      ? query.data.find((h) => h.id === user.active_household)
      : undefined) ?? query.data[0];
  return active?.current_user_role === 'owner';
}
