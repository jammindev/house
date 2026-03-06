export interface DocumentLink {
  interactionId: string;
  subject: string | null;
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
}

function buildHeaders(householdId?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-CSRFToken': getCsrfToken(),
    ...(householdId ? { 'X-Household-Id': householdId } : {}),
  };
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

export async function fetchDocuments(
  householdId?: string | null,
  opts?: { unlinkedOnly?: boolean },
): Promise<DocumentItem[]> {
  const params = new URLSearchParams({ ordering: '-created_at' });
  // Exclude photos — photos are managed in the photos section
  params.set('type__neq_photo', 'true');

  const res = await fetch(
    `/api/documents/documents/?${params.toString()}`,
    { headers: buildHeaders(householdId) },
  );
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  const data = (await res.json()) as unknown;
  const list: DocumentItem[] = Array.isArray(data)
    ? (data as DocumentItem[])
    : ((data as { results?: DocumentItem[] }).results ?? []);

  // Exclude photos client-side (the API doesn't support neq filter directly)
  const nonPhoto = list.filter((d) => d.type !== 'photo');

  if (opts?.unlinkedOnly) {
    return nonPhoto.filter((d) => !d.interaction);
  }
  return nonPhoto;
}

export async function updateDocument(
  id: string,
  data: { name?: string; notes?: string; type?: string },
  householdId?: string | null,
): Promise<DocumentItem> {
  const res = await fetch(`/api/documents/documents/${id}/`, {
    method: 'PATCH',
    headers: {
      ...buildHeaders(householdId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update document: ${res.status}`);
  return (await res.json()) as DocumentItem;
}

export async function deleteDocument(
  id: string,
  householdId?: string | null,
): Promise<void> {
  const res = await fetch(`/api/documents/documents/${id}/`, {
    method: 'DELETE',
    headers: buildHeaders(householdId),
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
