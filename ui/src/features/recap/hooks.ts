import { useQuery } from '@tanstack/react-query';
import { fetchLatestRecap, fetchRecap, fetchRecaps } from '@/lib/api/recap';

export const recapKeys = {
  all: ['recap'] as const,
  list: () => [...recapKeys.all, 'list'] as const,
  latest: () => [...recapKeys.all, 'latest'] as const,
  detail: (month: string) => [...recapKeys.all, month] as const,
};

/**
 * A recap is a frozen memory: once fetched it cannot change, so there is no point
 * refetching it on every focus. The generous `staleTime` is not an optimization
 * guess — it follows from the snapshot being immutable by design.
 */
const FROZEN = { staleTime: 5 * 60_000 } as const;

export function useRecapHistory() {
  return useQuery({ queryKey: recapKeys.list(), queryFn: fetchRecaps, ...FROZEN });
}

/** `null` when the last closed month had too little to tell (API answers 204). */
export function useLatestRecap() {
  return useQuery({ queryKey: recapKeys.latest(), queryFn: fetchLatestRecap, ...FROZEN });
}

export function useRecap(month: string | undefined) {
  return useQuery({
    queryKey: recapKeys.detail(month ?? ''),
    queryFn: () => fetchRecap(month as string),
    enabled: Boolean(month),
    ...FROZEN,
  });
}
