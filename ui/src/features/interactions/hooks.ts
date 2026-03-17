import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInteractions,
  createInteraction,
  deleteInteraction,
  fetchInteraction,
  updateInteraction,
  type CreateInteractionInput,
} from '@/lib/api/interactions';

interface InteractionFilters {
  search?: string;
  type?: string;
  status?: string;
  zone?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

export const interactionKeys = {
  all: ['interactions'] as const,
  list: (filters?: InteractionFilters) =>
    [...interactionKeys.all, 'list', filters] as const,
  detail: (id: string) => [...interactionKeys.all, 'detail', id] as const,
};

export function useInteractions(filters: InteractionFilters = {}) {
  return useQuery({
    queryKey: interactionKeys.list(filters),
    queryFn: () => fetchInteractions(filters),
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInteractionInput) => createInteraction(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: interactionKeys.all }),
  });
}

export function useDeleteInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: interactionKeys.all }),
  });
}

export function useInteraction(id: string) {
  return useQuery({
    queryKey: interactionKeys.detail(id),
    queryFn: () => fetchInteraction(id),
    enabled: !!id,
  });
}

export function useUpdateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateInteractionInput> }) =>
      updateInteraction(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: interactionKeys.all }),
  });
}
