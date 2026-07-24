import { api } from '@/lib/axios';

export type BriefingType = 'recurring' | 'event';
export type BriefingChannel = 'telegram';
export type BriefingSendStatus = 'sent' | 'error' | 'skipped_condition';

/** Compact summary of the most recent send attempt (card glance). */
export interface BriefingLastSend {
  status: BriefingSendStatus;
  content: string;
  created_at: string;
}

export interface Briefing {
  id: string;
  household: string;
  title: string;
  prompt: string;
  condition: string;
  channel: BriefingChannel;
  briefing_type: BriefingType;
  is_private: boolean;
  is_active: boolean;
  /** Local times of day it fires, e.g. ["16:00:00"]. */
  send_times: string[];
  /** Python weekday ints (Mon=0…Sun=6) it may fire on; empty = every day. */
  weekdays: number[];
  /** Next fire instant (ISO), or null if inactive/no schedule. Read-only. */
  next_send_at: string | null;
  /** Most recent send attempt, or null if never sent. Read-only. */
  last_send: BriefingLastSend | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_name: string | null;
}

interface PaginatedResponse<T> {
  results?: T[];
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<T>;
    if (Array.isArray(paginated.results)) return paginated.results;
  }
  return [];
}

export interface BriefingPayload {
  title: string;
  prompt: string;
  condition?: string;
  is_private?: boolean;
  briefing_type?: BriefingType;
  is_active?: boolean;
  send_times?: string[];
  weekdays?: number[];
}

export async function fetchBriefings(): Promise<Briefing[]> {
  const { data } = await api.get('/briefings/briefings/', { params: { ordering: '-created_at' } });
  return normalizeList<Briefing>(data);
}

export async function createBriefing(payload: BriefingPayload): Promise<Briefing> {
  const { data } = await api.post('/briefings/briefings/', {
    title: payload.title,
    prompt: payload.prompt,
    condition: payload.condition ?? '',
    is_private: payload.is_private ?? false,
    briefing_type: payload.briefing_type ?? 'recurring',
    is_active: payload.is_active ?? false,
    send_times: payload.send_times ?? [],
    weekdays: payload.weekdays ?? [],
  });
  return data as Briefing;
}

export async function updateBriefing(
  id: string,
  payload: Partial<BriefingPayload>,
): Promise<Briefing> {
  const { data } = await api.patch(`/briefings/briefings/${id}/`, payload);
  return data as Briefing;
}

export async function deleteBriefing(id: string): Promise<void> {
  await api.delete(`/briefings/briefings/${id}/`);
}

export interface ConditionVerdict {
  send: boolean;
  reason: string;
}

export interface BriefingPreview {
  text: string;
  /** null when the briefing has no condition (lot 4). */
  condition_verdict: ConditionVerdict | null;
}

/** Generate the briefing content for the current user, without sending (Lot 2/4). */
export async function previewBriefing(id: string): Promise<BriefingPreview> {
  const { data } = await api.post(`/briefings/briefings/${id}/preview/`);
  return data as BriefingPreview;
}

export interface BriefingSendSummary {
  total_recipients: number;
  sent: number;
  skipped_no_telegram: number;
  errors: number;
}

/** Generate + push the briefing to its recipients right now (Lot 2). */
export async function sendBriefingNow(id: string): Promise<BriefingSendSummary> {
  const { data } = await api.post(`/briefings/briefings/${id}/send-now/`);
  return data as BriefingSendSummary;
}

/** One line of a briefing's send history (Lot 5). */
export interface BriefingSendLogEntry {
  id: string;
  status: BriefingSendStatus;
  /** Sent message (status=sent), skip reason (skipped_condition), or "" (error). */
  content: string;
  slot_date: string;
  slot_time: string;
  user: number | null;
  user_name: string | null;
  created_at: string;
}

export async function fetchBriefingHistory(id: string): Promise<BriefingSendLogEntry[]> {
  const { data } = await api.get(`/briefings/briefings/${id}/history/`);
  return normalizeList<BriefingSendLogEntry>(data);
}
