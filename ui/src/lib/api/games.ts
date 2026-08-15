import { api } from '@/lib/axios';

// ── Types ────────────────────────────────────────────────────────────────────

export type HuntStatus = 'draft' | 'active' | 'done' | 'abandoned';

/** Verdicts rendus par le serveur au scan d'une étiquette. */
export type ScanVerdict =
  | 'no_hunt'
  | 'wrong_zone'
  | 'already_found'
  | 'advanced'
  | 'finished';

export interface HuntStep {
  id: string;
  position: number;
  zone: string;
  zone_name: string;
  riddle: string;
  found_at: string | null;
}

/** Vue de composition — le parent voit tout, trésor compris. */
export interface Hunt {
  id: string;
  name: string;
  status: HuntStatus;
  treasure_text: string;
  steps: HuntStep[];
  step_count: number;
  found_count: number;
  started_at: string | null;
  finished_at: string | null;
}

/**
 * Vue de partie — ce que le téléphone qui circule a le droit de savoir.
 *
 * `treasure_text` reste `null` tant que la chasse n'est pas terminée, et
 * `current_step` ne porte **jamais** la pièce : c'est précisément la réponse.
 */
export interface HuntPlay {
  id: string;
  name: string;
  status: HuntStatus;
  current_step: { id: string; position: number; riddle: string } | null;
  step_count: number;
  found_count: number;
  treasure_text: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface HuntPayload {
  name: string;
  treasure_text: string;
  steps: { zone: string; riddle: string }[];
}

// ── Appels ───────────────────────────────────────────────────────────────────

export async function fetchHunts(): Promise<Hunt[]> {
  const { data } = await api.get('/games/hunts/');
  return (Array.isArray(data) ? data : (data.results ?? [])) as Hunt[];
}

export async function fetchHunt(id: string): Promise<Hunt> {
  const { data } = await api.get(`/games/hunts/${id}/`);
  return data as Hunt;
}

export async function createHunt(payload: HuntPayload): Promise<Hunt> {
  const { data } = await api.post('/games/hunts/', payload);
  return data as Hunt;
}

export async function updateHunt(id: string, payload: Partial<HuntPayload>): Promise<Hunt> {
  const { data } = await api.patch(`/games/hunts/${id}/`, payload);
  return data as Hunt;
}

export async function deleteHunt(id: string): Promise<void> {
  await api.delete(`/games/hunts/${id}/`);
}

export async function startHunt(id: string): Promise<HuntPlay> {
  const { data } = await api.post(`/games/hunts/${id}/start/`);
  return data as HuntPlay;
}

export async function abandonHunt(id: string): Promise<HuntPlay> {
  const { data } = await api.post(`/games/hunts/${id}/abandon/`);
  return data as HuntPlay;
}

/**
 * La vue de partie d'une chasse désignée.
 *
 * `fetchActiveHunt` ne peut pas servir l'écran de victoire : la dernière étape
 * fait passer la chasse en `done`, donc « la chasse active » devient `null` à
 * l'instant où il faut révéler le trésor.
 */
export async function fetchHuntPlay(id: string): Promise<HuntPlay> {
  const { data } = await api.get(`/games/hunts/${id}/play/`);
  return (data as { hunt: HuntPlay }).hunt;
}

/** La chasse en cours du foyer — `null` s'il n'y en a pas. */
export async function fetchActiveHunt(): Promise<HuntPlay | null> {
  const { data } = await api.get('/games/hunts/active/');
  return (data as { hunt: HuntPlay | null }).hunt;
}
