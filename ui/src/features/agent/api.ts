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

export interface AgentAnswer {
  answer: string;
  citations: AgentCitation[];
  metadata: AgentAnswerMetadata;
}

export async function askAgent(question: string): Promise<AgentAnswer> {
  const { data } = await api.post<AgentAnswer>('/agent/ask/', { question });
  return data;
}
