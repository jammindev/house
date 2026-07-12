import { api } from '@/lib/axios';

export interface PingRow {
  /** Ping discriminator, mirrors the backend registry (e.g. 'egg_log'). */
  ping_type: string;
  module: string | null;
  enabled: boolean;
  /** Local send time in the household timezone, HH:MM. */
  send_at: string;
}

export interface UpdatePingInput {
  enabled: boolean;
  send_at?: string;
}

export async function fetchPings(): Promise<PingRow[]> {
  const { data } = await api.get<PingRow[]>('/pings/');
  return data;
}

export async function updatePing(pingType: string, payload: UpdatePingInput): Promise<PingRow> {
  const { data } = await api.put<PingRow>(`/pings/${pingType}/`, payload);
  return data;
}
