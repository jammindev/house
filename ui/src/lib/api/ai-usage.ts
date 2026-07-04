import { api } from '@/lib/axios';

/** KPI values for one time window (24h / 7d / 30d). */
export interface AIUsageWindow {
  calls: number;
  errors: number;
  error_rate: number | null;
  p95_ms: number | null;
  idk_rate: number | null;
  alerts: {
    idk_rate: boolean;
    p95_ms: boolean;
  };
}

export interface AIUsageSummary {
  windows: Record<string, AIUsageWindow>;
}

export interface AIUsageHistogramDay {
  date: string;
  counts: Record<string, number>;
}

export interface AIUsageHistogram {
  days: AIUsageHistogramDay[];
  features: string[];
}

export interface AIUsageCall {
  id: string;
  feature: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number;
  success: boolean;
  error_type: string | null;
  created_at: string;
}

export async function fetchAIUsageSummary(): Promise<AIUsageSummary> {
  const { data } = await api.get<AIUsageSummary>('/ai-usage/summary/');
  return data;
}

export async function fetchAIUsageHistogram(days = 30): Promise<AIUsageHistogram> {
  const { data } = await api.get<AIUsageHistogram>('/ai-usage/histogram/', {
    params: { days },
  });
  return data;
}

export async function fetchAIUsageRecent(feature?: string): Promise<AIUsageCall[]> {
  const { data } = await api.get<{ results: AIUsageCall[] }>('/ai-usage/recent/', {
    params: feature ? { feature } : {},
  });
  return data.results;
}
