import { api } from '@/lib/axios';

export interface PhotoDocument {
  id: string;
  name: string;
  notes?: string | null;
  mime_type: string;
  file_path: string;
  file_url: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  created_by_name?: string | null;
}

export async function fetchPhotos(): Promise<PhotoDocument[]> {
  const { data } = await api.get('/documents/documents/', {
    params: { type: 'photo', ordering: '-created_at' },
  });
  return Array.isArray(data)
    ? (data as PhotoDocument[])
    : ((data as { results?: PhotoDocument[] }).results ?? []);
}
