import { api } from '@/lib/axios';

/** Renovation phase of a photo relative to a linked entity. Empty = unclassified. */
export type PhotoPhase = 'before' | 'during' | 'after';

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

/** Generic backlink: any household entity a document is attached to. */
export interface EntityLinkSummary {
  entity_type: string;
  id: string;
  label: string;
  url_path: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  file_path: string;
  file_url: string | null;
  thumbnail_url?: string | null;
  medium_url?: string | null;
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
  /** Phase of this photo for the entity being filtered on (null when unscoped). */
  phase?: PhotoPhase | '' | null;
}

export interface DocumentDetail extends DocumentItem {
  zone_links: ZoneLinkSummary[];
  project_links: ProjectLinkSummary[];
  entity_links: EntityLinkSummary[];
  recent_interaction_candidates: LinkedInteractionSummary[];
}

export interface UploadDocumentInput {
  file: File;
  name?: string;
  type?: DocumentType | 'photo' | '';
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
  project?: string;
  equipment?: string;
  [key: string]: string | undefined;
}

function normalizeId(d: DocumentItem & { id: string | number }): DocumentItem {
  return { ...d, id: String(d.id) };
}

export async function fetchDocuments(filters: DocumentFilters = {}): Promise<DocumentItem[]> {
  // Forward every filter as a query param: `search`/`type` are reserved, any
  // other key is an entity link filter (?zone= / ?project= / ?task= / ?chicken=…)
  // resolved polymorphically by the backend via the searchables registry.
  const params: Record<string, string> = { ordering: '-created_at' };
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }

  const { data } = await api.get('/documents/documents/', { params });
  const list: Array<DocumentItem & { id: string | number }> = Array.isArray(data)
    ? data
    : ((data as { results?: Array<DocumentItem & { id: string | number }> }).results ?? []);

  return list.filter((d) => d.type !== 'photo').map(normalizeId);
}

export async function fetchPhotoDocuments(filters: Omit<DocumentFilters, 'type'> = {}): Promise<DocumentItem[]> {
  const params: Record<string, string> = { ordering: '-created_at', type: 'photo' };
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'type') continue; // forced to 'photo'
    if (value) params[key] = value;
  }

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

/**
 * Entity types that expose document attach/detach endpoints, mapped to their
 * URL base. Reads go through the polymorphic DocumentLink (`?<entityType>=id`);
 * writes still go through each entity's wrapper endpoint (kept for compat).
 */
const DOCUMENT_LINK_ENDPOINTS: Record<string, (id: string) => string> = {
  project: (id) => `/projects/projects/${id}`,
  equipment: (id) => `/equipment/${id}`,
  zone: (id) => `/zones/${id}`,
  task: (id) => `/tasks/tasks/${id}`,
  chicken: (id) => `/chickens/${id}`,
};

export function supportsDocumentLinking(entityType: string): boolean {
  return entityType in DOCUMENT_LINK_ENDPOINTS;
}

/**
 * Root React Query key of an entity's detail cache, so attaching/detaching a
 * document or photo can refresh its `tab_counts`. Pluralization is irregular
 * (equipment stays singular) — keep this map explicit rather than guessing.
 */
const ENTITY_DETAIL_QUERY_KEYS: Record<string, readonly unknown[]> = {
  project: ['projects'],
  equipment: ['equipment'],
  zone: ['zones'],
  task: ['tasks'],
  chicken: ['chickens'],
};

export function entityDetailQueryKey(entityType: string): readonly unknown[] | null {
  return ENTITY_DETAIL_QUERY_KEYS[entityType] ?? null;
}

export async function attachEntityDocument(
  entityType: string,
  objectId: string,
  documentId: string,
  phase?: PhotoPhase | '',
): Promise<void> {
  const base = DOCUMENT_LINK_ENDPOINTS[entityType];
  if (!base) throw new Error(`Unsupported entity type for document linking: ${entityType}`);
  await api.post(`${base(objectId)}/attach_document/`, {
    document_id: documentId,
    ...(phase ? { phase } : {}),
  });
}

/** Set the renovation phase of a photo relative to a linked entity ('' clears it). */
export async function setDocumentPhase(
  entityType: string,
  objectId: string,
  documentId: string,
  phase: PhotoPhase | '',
): Promise<void> {
  const base = DOCUMENT_LINK_ENDPOINTS[entityType];
  if (!base) throw new Error(`Unsupported entity type for document linking: ${entityType}`);
  await api.post(`${base(objectId)}/set_document_phase/`, {
    document_id: documentId,
    phase,
  });
}

export async function detachEntityDocument(
  entityType: string,
  objectId: string,
  documentId: string,
): Promise<void> {
  const base = DOCUMENT_LINK_ENDPOINTS[entityType];
  if (!base) throw new Error(`Unsupported entity type for document linking: ${entityType}`);
  await api.post(`${base(objectId)}/detach_document/`, { document_id: documentId });
}

export async function reprocessDocumentOcr(id: string): Promise<DocumentDetail> {
  const { data } = await api.post(`/documents/documents/${id}/reprocess_ocr/`);
  return { ...(data as DocumentDetail & { id: string | number }), id: String((data as { id: string | number }).id) };
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
