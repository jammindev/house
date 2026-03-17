import { api } from '@/lib/axios';

export interface InteractionListItem {
  id: string;
  subject: string;
  content: string;
  type: string;
  status: string | null;
  occurred_at: string;
  tags: string[];
  zone_names: string[];
  document_count: number;
  created_by_name?: string;
  project?: string | null;
  project_title?: string | null;
}

export interface CreateInteractionInput {
  subject: string;
  content?: string;
  type: string;
  status?: string | null;
  occurred_at: string;
  zone_ids: string[];
  tags_input?: string[];
  metadata?: Record<string, unknown>;
  document_ids?: string[];
  project?: string | null;
}

export interface LinkDocumentToInteractionInput {
  interactionId: string;
  documentId: string;
  role?: string;
  note?: string;
}

interface FetchInteractionsOptions {
  search?: string;
  type?: string;
  status?: string;
  zone?: string;
  limit?: number;
  offset?: number;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

export interface FetchInteractionsResult {
  items: InteractionListItem[];
  count: number;
  next: string | null;
  previous: string | null;
}

function normalize(payload: unknown): FetchInteractionsResult {
  if (Array.isArray(payload)) {
    const items = payload as InteractionListItem[];
    return {
      items,
      count: items.length,
      next: null,
      previous: null,
    };
  }

  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<InteractionListItem>;
    if (Array.isArray(paginated.results)) {
      return {
        items: paginated.results,
        count: typeof paginated.count === 'number' ? paginated.count : paginated.results.length,
        next: paginated.next ?? null,
        previous: paginated.previous ?? null,
      };
    }
  }

  return {
    items: [],
    count: 0,
    next: null,
    previous: null,
  };
}

export async function fetchInteractions(
  options: FetchInteractionsOptions = {}
): Promise<FetchInteractionsResult> {
  const { search, type, status, zone, limit = 8, offset = 0 } = options;

  const params: Record<string, string | number> = { ordering: '-occurred_at' };
  if (search) params.search = search;
  if (type) params.type = type;
  if (status) params.status = status;
  if (zone) params.zone = zone;
  if (limit > 0) params.limit = limit;
  if (offset > 0) params.offset = offset;

  const { data } = await api.get('/interactions/interactions/', { params });
  return normalize(data);
}

export async function searchInteractions(
  search: string,
  options: Omit<FetchInteractionsOptions, 'search'> = {}
): Promise<FetchInteractionsResult> {
  return fetchInteractions({
    ...options,
    search,
  });
}

export async function createInteraction(
  input: CreateInteractionInput,
): Promise<InteractionListItem & { linked_document_ids?: string[] }> {
  const { data } = await api.post('/interactions/interactions/', {
    ...input,
    content: input.content ?? '',
    status: input.status ?? null,
    metadata: input.metadata ?? {},
    document_ids: input.document_ids ?? [],
    enriched_text: '',
  });
  return data as InteractionListItem;
}

export async function deleteInteraction(id: string): Promise<void> {
  await api.delete(`/interactions/interactions/${id}/`);
}

export async function linkDocumentToInteraction(
  input: LinkDocumentToInteractionInput,
): Promise<void> {
  await api.post('/interactions/interaction-documents/', {
    interaction: input.interactionId,
    document: input.documentId,
    role: input.role ?? 'attachment',
    note: input.note ?? '',
  });
}
