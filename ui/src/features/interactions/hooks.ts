import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInteractions,
  createInteraction,
  deleteInteraction,
  fetchInteraction,
  updateInteraction,
  linkDocumentToInteraction,
  type CreateInteractionInput,
} from '@/lib/api/interactions';
import { documentKeys } from '@/features/documents/hooks';
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

/**
 * Joindre un document à une entrée du journal — le justificatif d'une dépense.
 *
 * Le lien vit dans `DocumentLink` (table polymorphe), donc la liste se relit par
 * `?linked_to=interaction:{id}` : c'est le cache `documents` qu'il faut invalider,
 * pas celui de l'interaction, qui ne porte pas ses pièces.
 */
export function useAttachDocumentToInteraction(interactionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      linkDocumentToInteraction({ interactionId, documentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
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
