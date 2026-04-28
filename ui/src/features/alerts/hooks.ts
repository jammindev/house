import { useQuery } from '@tanstack/react-query';
import { fetchAlertsSummary } from '@/lib/api/alerts';

export const alertsKeys = {
  all: ['alerts'] as const,
  summary: () => [...alertsKeys.all, 'summary'] as const,
};

export function useAlertsSummary() {
  return useQuery({
    queryKey: alertsKeys.summary(),
    queryFn: fetchAlertsSummary,
    staleTime: 60_000,
  });
}
