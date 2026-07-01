import { api } from '@/lib/axios';

export interface AgentCitation {
  entity_type: string;
  id: string;
  label: string;
  snippet: string;
  url_path: string;
}

export interface AgentAnswerMetadata {
  duration_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  model?: string;
  hits_count?: number;
  reason?: string;
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

export async function postConversationMessage(
  conversationId: string,
  question: string,
): Promise<AgentMessageRow> {
  const { data } = await api.post<AgentMessageRow>(
    `/agent/conversations/${conversationId}/messages/`,
    { question },
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
