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
}

export interface DocumentUploadResponse {
  document: DocumentDetail;
  detail_url: string;
}

function buildHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-CSRFToken': getCsrfToken(),
  };
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

export async function fetchDocuments(
  opts?: { withoutActivityOnly?: boolean },
): Promise<DocumentItem[]> {
  const params = new URLSearchParams({ ordering: '-created_at' });
  if (opts?.withoutActivityOnly) {
    params.set('qualification_state', 'without_activity');
  }

  const res = await fetch(
    `/api/documents/documents/?${params.toString()}`,
    { headers: buildHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  const data = (await res.json()) as unknown;
  const list: DocumentItem[] = Array.isArray(data)
    ? (data as Array<DocumentItem & { id: string | number }>)
    : (((data as { results?: Array<DocumentItem & { id: string | number }> }).results) ?? []);

  return list
    .filter((d) => d.type !== 'photo')
    .map((d) => ({
      ...d,
      id: String(d.id),
    }));
}

export async function fetchDocumentDetail(
  id: string,
): Promise<DocumentDetail> {
  const res = await fetch(`/api/documents/documents/${id}/`, {
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch document detail: ${res.status}`);
  const payload = (await res.json()) as DocumentDetail & { id: string | number };
  return {
    ...payload,
    id: String(payload.id),
  };
}

export async function uploadDocument(
  input: UploadDocumentInput,
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.set('file', input.file);
  if (input.name) formData.set('name', input.name);
  if (input.type) formData.set('type', input.type);
  if (input.notes) formData.set('notes', input.notes);

  const res = await fetch('/api/documents/documents/upload/', {
    method: 'POST',
    headers: buildHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload document: ${res.status}`);
  const payload = (await res.json()) as DocumentUploadResponse;
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
  data: { name?: string; notes?: string; type?: string },
): Promise<DocumentItem> {
  const res = await fetch(`/api/documents/documents/${id}/`, {
    method: 'PATCH',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update document: ${res.status}`);
  const payload = (await res.json()) as DocumentItem & { id: string | number };
  return { ...payload, id: String(payload.id) };
}

export async function deleteDocument(
  id: string,
): Promise<void> {
  const res = await fetch(`/api/documents/documents/${id}/`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete document: ${res.status}`);
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
