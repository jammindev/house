import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchInteractions,
  createInteraction,
  deleteInteraction,
  fetchInteraction,
  updateInteraction,
  type CreateInteractionInput,
} from '@/lib/api/interactions';
import { INTERACTIONS_ROOT } from '@/features/money/keys';
import { useInvalidateMoney } from '@/features/money/invalidate';

interface InteractionFilters {
  search?: string;
  type?: string;
  status?: string;
  zone?: string;
  contact?: string;
  structure?: string;
  tags?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | boolean | undefined;
}

export const interactionKeys = {
  all: INTERACTIONS_ROOT,
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
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (payload: CreateInteractionInput) => createInteraction(payload),
    onSuccess: invalidate,
  });
}

export function useDeleteInteraction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: invalidate,
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
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateInteractionInput> }) =>
      updateInteraction(id, payload),
    onSuccess: invalidate,
  });
}
