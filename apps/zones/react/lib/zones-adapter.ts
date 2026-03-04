import type { Zone, ZoneDetail, ZoneMutationPayload, ZonePhoto } from '../types/zones';
import { DEFAULT_FIRST_LEVEL_COLOR, ROOT_ZONE_COLOR, normalizeHexColor } from './colors';

export type ApiZone = {
  id: string;
  household?: string;
  name: string;
  parent?: string | null;
  note?: string | null;
  surface?: number | string | null;
  color?: string | null;
  full_path?: string;
  depth?: number;
  children_count?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function mapApiZoneToLegacyShape(apiZone: ApiZone): Zone {
  const parsedSurface =
    typeof apiZone.surface === 'string'
      ? Number.parseFloat(apiZone.surface)
      : typeof apiZone.surface === 'number'
        ? apiZone.surface
        : null;

  return {
    id: apiZone.id,
    name: apiZone.name,
    parent_id: apiZone.parent ?? null,
    note: apiZone.note ?? '',
    surface: Number.isNaN(parsedSurface) ? null : parsedSurface,
    color: normalizeHexColor(apiZone.color ?? ROOT_ZONE_COLOR, DEFAULT_FIRST_LEVEL_COLOR),
    created_by: apiZone.created_by ?? undefined,
    full_path: apiZone.full_path,
    depth: apiZone.depth,
    children_count: apiZone.children_count,
    updated_at: apiZone.updated_at,
  };
}

export function mapApiZoneToZoneDetail(apiZone: ApiZone & { parent_name?: string | null }): ZoneDetail {
  return {
    ...mapApiZoneToLegacyShape(apiZone),
    household_id: apiZone.household ?? '',
    created_at: apiZone.created_at ?? null,
    parent:
      apiZone.parent
        ? {
            id: apiZone.parent,
            name: apiZone.parent_name ?? '',
            color: null,
          }
        : null,
  };
}

export function mapLegacyPayloadToApi(payload: ZoneMutationPayload): Record<string, unknown> {
  return {
    name: payload.name.trim(),
    parent: payload.parent_id,
    note: payload.note ?? '',
    surface: payload.surface,
    color: payload.color ?? undefined,
  };
}

export function mapApiPhoto(payload: Record<string, unknown>): ZonePhoto {
  return {
    zone: String(payload.zone ?? ''),
    document: String(payload.document ?? ''),
    document_name: typeof payload.document_name === 'string' ? payload.document_name : '',
    document_file_path: typeof payload.document_file_path === 'string' ? payload.document_file_path : '',
    role: typeof payload.role === 'string' ? payload.role : 'photo',
    note: typeof payload.note === 'string' ? payload.note : '',
    created_at: typeof payload.created_at === 'string' ? payload.created_at : undefined,
  };
}
