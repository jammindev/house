import { api } from '@/lib/axios';
import type { InteractionListItem } from './interactions';

// Kept in sync with apps/interactions/services.py::RENOVATION_ELEMENTS / RENOVATION_TYPES.
export const RENOVATION_ELEMENTS = [
  'paint',
  'floor',
  'wall',
  'ceiling',
  'joinery',
  'plumbing',
  'electrical',
  'heating',
  'furniture',
  'other',
] as const;
export type RenovationElement = (typeof RENOVATION_ELEMENTS)[number];

export const RENOVATION_TYPES = [
  'installation',
  'replacement',
  'upgrade',
  'repair',
  'maintenance',
] as const;
export type RenovationType = (typeof RENOVATION_TYPES)[number];

/** Structured fields of a renovation entry, read from `metadata`. */
export interface RenovationMetadata {
  kind: 'renovation';
  element: RenovationElement;
  product: string;
  brand: string;
  reference: string;
}

export interface RenovationCreateInput {
  element: RenovationElement;
  interaction_type?: RenovationType;
  product?: string;
  brand?: string;
  reference?: string;
  subject?: string;
  occurred_at?: string | null;
  notes?: string;
  zone_ids: string[];
}

export type RenovationUpdateInput = Partial<RenovationCreateInput>;

export async function createRenovation(
  input: RenovationCreateInput,
): Promise<InteractionListItem> {
  const { data } = await api.post('/interactions/interactions/renovation/', input);
  return data as InteractionListItem;
}

export async function updateRenovation(
  id: string,
  input: RenovationUpdateInput,
): Promise<InteractionListItem> {
  const { data } = await api.patch(`/interactions/interactions/${id}/renovation/`, input);
  return data as InteractionListItem;
}
