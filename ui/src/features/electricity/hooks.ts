import { useQuery } from '@tanstack/react-query';
import {
  fetchBoards,
  fetchBreakers,
  fetchCircuits,
  fetchUsagePoints,
  fetchLinks,
} from '@/lib/api/electricity';

// ── Query key factory ─────────────────────────────────────────────────────────

export const electricityKeys = {
  all: ['electricity'] as const,
  boards: () => [...electricityKeys.all, 'boards'] as const,
  board: (id: string) => [...electricityKeys.all, 'board', id] as const,
  breakers: (boardId?: string) => [...electricityKeys.all, 'breakers', boardId ?? 'all'] as const,
  circuits: (boardId?: string) => [...electricityKeys.all, 'circuits', boardId ?? 'all'] as const,
  usagePoints: (boardId?: string) => [...electricityKeys.all, 'usage-points', boardId ?? 'all'] as const,
  links: (boardId?: string) => [...electricityKeys.all, 'links', boardId ?? 'all'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useElectricityBoards() {
  return useQuery({
    queryKey: electricityKeys.boards(),
    queryFn: fetchBoards,
  });
}

export function useElectricityBoard(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.board(boardId ?? ''),
    queryFn: () => fetchBoards().then((boards) => boards.find((b) => b.id === boardId) ?? null),
    enabled: Boolean(boardId),
  });
}

export function useBreakers(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.breakers(boardId),
    queryFn: () => fetchBreakers(boardId),
    enabled: Boolean(boardId),
  });
}

export function useCircuits(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.circuits(boardId),
    queryFn: () => fetchCircuits(boardId),
    enabled: Boolean(boardId),
  });
}

export function useUsagePoints(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.usagePoints(boardId),
    queryFn: () => fetchUsagePoints(boardId),
    enabled: Boolean(boardId),
  });
}

export function useLinks(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.links(boardId),
    queryFn: () => fetchLinks(boardId),
    enabled: Boolean(boardId),
  });
}
