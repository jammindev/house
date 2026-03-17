import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPhotoDocuments, deleteDocument } from '@/lib/api/documents';

export interface PhotoFilters {
  search?: string;
  zone?: string;
  [key: string]: string | undefined;
}

export const photoKeys = {
  all: ['photos'] as const,
  list: (filters?: PhotoFilters) => [...photoKeys.all, 'list', filters ?? {}] as const,
};

export function usePhotos(filters?: PhotoFilters) {
  return useQuery({
    queryKey: photoKeys.list(filters),
    queryFn: () => fetchPhotoDocuments(filters),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: photoKeys.all }),
  });
}
