import { api } from '@/lib/axios';

export interface AgentCitation {
  entity_type: string;
  id: string;
  label: string;
  snippet: string;
  url_path: string;
}

/** An entity the agent created this turn (via create_entity), for undo. */
export interface AgentCreatedEntity {
  entity_type: string;
  id: string;
  label: string;
  url_path: string;
}

/** An entity the agent modified this turn (via update_entity), for undo. */
export interface AgentUpdatedEntity {
  entity_type: string;
  id: string;
  label: string;
  url_path: string;
  /** Values of the changed fields BEFORE the update — re-applied on undo. */
  previous: Record<string, unknown>;
  changed: Record<string, unknown>;
}

export interface AgentAnswerMetadata {
  duration_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  model?: string;
  hits_count?: number;
  reason?: string;
  /** True when the answer hit the model's max_tokens and was cut short. */
  truncated?: boolean;
  created_entities?: AgentCreatedEntity[];
  updated_entities?: AgentUpdatedEntity[];
  [key: string]: unknown;
}

/** A persisted conversation turn, as returned by the API. */
export interface AgentMessageRow {
  id: string;
  role: 'user' | 'agent';
  content: string;
  citations: AgentCitation[];
  metadata: AgentAnswerMetadata;
  created_at: string;
}

/** Lightweight conversation row for the list. */
export interface AgentConversationRow {
  id: string;
  title: string;
  last_message_at: string | null;
  created_at: string;
  message_count?: number;
}

/** Full conversation with its ordered messages. */
export interface AgentConversationDetail extends AgentConversationRow {
  /** Set when the conversation is anchored to a household entity (e.g. a project). */
  context_entity_type?: string;
  context_object_id?: string;
  messages: AgentMessageRow[];
}

/** Some endpoints paginate, some don't — normalise to a plain array. */
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'results' in data) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export async function listConversations(): Promise<AgentConversationRow[]> {
  const { data } = await api.get('/agent/conversations/');
  return asArray<AgentConversationRow>(data);
}

export async function getConversation(id: string): Promise<AgentConversationDetail> {
  const { data } = await api.get<AgentConversationDetail>(`/agent/conversations/${id}/`);
  return data;
}

export async function createConversation(): Promise<AgentConversationDetail> {
  const { data } = await api.post<AgentConversationDetail>('/agent/conversations/', {});
  return data;
}

/**
 * Get-or-create THE conversation anchored to one household entity for the
 * current user. Backs the entity-scoped assistant (e.g. a project's "Assistant"
 * tab): one persistent, context-preloaded conversation per (user, entity).
 */
export async function getOrCreateEntityConversation(
  entityType: string,
  objectId: string,
): Promise<AgentConversationDetail> {
  const { data } = await api.get<AgentConversationDetail>(
    '/agent/conversations/for_context/',
    { params: { entity_type: entityType, object_id: objectId } },
  );
  return data;
}

/**
 * The agent loop can chain several LLM round-trips (up to ~2 min server-side),
 * so this call gets its own generous timeout instead of hanging forever if the
 * backend never answers.
 */
const AGENT_MESSAGE_TIMEOUT_MS = 180_000;

export async function postConversationMessage(
  conversationId: string,
  question: string,
): Promise<AgentMessageRow> {
  const { data } = await api.post<AgentMessageRow>(
    `/agent/conversations/${conversationId}/messages/`,
    { question },
    { timeout: AGENT_MESSAGE_TIMEOUT_MS },
  );
  return data;
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<AgentConversationRow> {
  const { data } = await api.patch<AgentConversationRow>(`/agent/conversations/${id}/`, {
    title,
  });
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/agent/conversations/${id}/`);
}
