import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDocuments,
  fetchDocumentDetail,
  uploadDocument,
  updateDocument,
  deleteDocument,
  type DocumentFilters,
  type UploadDocumentInput,
} from '@/lib/api/documents';

export const documentKeys = {
  all: ['documents'] as const,
  list: (filters?: DocumentFilters) =>
    [...documentKeys.all, 'list', filters as Record<string, unknown>] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
};

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: () => fetchDocuments(filters),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => fetchDocumentDetail(id),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateDocument>[1];
    }) => updateDocument(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}
