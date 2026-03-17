import { api } from '@/lib/axios';

export interface LinkedInteractionSummary {
  id: string;
  subject: string;
  type: string;
  occurred_at: string;
}

export interface DocumentQualification {
  has_activity_context: boolean;
  qualification_state: 'without_activity' | 'activity_linked';
  linked_interactions_count: number;
  has_secondary_context: boolean;
}

export interface ZoneLinkSummary {
  zone_id: string;
  zone_name: string;
}

export interface ProjectLinkSummary {
  project_id: string;
  project_name: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string;
  type: string;
  notes?: string | null;
  ocr_text?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  created_by_name?: string | null;
  interaction?: string | null;
  interaction_subject?: string | null;
  qualification: DocumentQualification;
  linked_interactions: LinkedInteractionSummary[];
  legacy_interaction?: string | null;
  legacy_interaction_subject?: string | null;
}

export interface DocumentDetail extends DocumentItem {
  zone_links: ZoneLinkSummary[];
  project_links: ProjectLinkSummary[];
  recent_interaction_candidates: LinkedInteractionSummary[];
}

export interface UploadDocumentInput {
  file: File;
  name?: string;
  type?: DocumentType | '';
  notes?: string;
  zone?: string;
}

export interface DocumentUploadResponse {
  document: DocumentDetail;
  detail_url: string;
}

export interface DocumentFilters {
  search?: string;
  type?: string;
  zone?: string;
  [key: string]: string | undefined;
}

function normalizeId(d: DocumentItem & { id: string | number }): DocumentItem {
  return { ...d, id: String(d.id) };
}

export async function fetchDocuments(filters: DocumentFilters = {}): Promise<DocumentItem[]> {
  const params: Record<string, string> = { ordering: '-created_at' };
  if (filters.search) params.search = filters.search;
  if (filters.type) params.type = filters.type;
  if (filters.zone) params.zone = filters.zone;

  const { data } = await api.get('/documents/documents/', { params });
  const list: Array<DocumentItem & { id: string | number }> = Array.isArray(data)
    ? data
    : ((data as { results?: Array<DocumentItem & { id: string | number }> }).results ?? []);

  return list.filter((d) => d.type !== 'photo').map(normalizeId);
}

export async function fetchPhotoDocuments(filters: Omit<DocumentFilters, 'type'> = {}): Promise<DocumentItem[]> {
  const params: Record<string, string> = { ordering: '-created_at', type: 'photo' };
  if (filters.search) params.search = filters.search;
  if (filters.zone) params.zone = filters.zone;

  const { data } = await api.get('/documents/documents/', { params });
  const list: Array<DocumentItem & { id: string | number }> = Array.isArray(data)
    ? data
    : ((data as { results?: Array<DocumentItem & { id: string | number }> }).results ?? []);

  return list.map(normalizeId);
}

export async function fetchDocumentDetail(id: string): Promise<DocumentDetail> {
  const { data } = await api.get(`/documents/documents/${id}/`);
  return { ...(data as DocumentDetail & { id: string | number }), id: String((data as { id: string | number }).id) };
}

export async function uploadDocument(input: UploadDocumentInput): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.set('file', input.file);
  if (input.name) formData.set('name', input.name);
  if (input.type) formData.set('type', input.type);
  if (input.notes) formData.set('notes', input.notes);
  if (input.zone) formData.set('zone', input.zone);

  const { data } = await api.post('/documents/documents/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const payload = data as DocumentUploadResponse;
  return {
    ...payload,
    document: {
      ...payload.document,
      id: String(payload.document.id),
    },
  };
}

export async function updateDocument(
  id: string,
  payload: { name?: string; notes?: string; type?: string },
): Promise<DocumentItem> {
  const { data } = await api.patch(`/documents/documents/${id}/`, payload);
  return normalizeId(data as DocumentItem & { id: string | number });
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/documents/${id}/`);
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DOCUMENT_TYPES = [
  'document',
  'invoice',
  'manual',
  'warranty',
  'receipt',
  'plan',
  'certificate',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
