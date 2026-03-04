import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Zone, ZoneMutationPayload, ZonesPageProps } from '../types/zones';
import { DEFAULT_FIRST_LEVEL_COLOR, ROOT_ZONE_COLOR, lightenHexColor, normalizeHexColor } from '../lib/colors';
import { mapApiZoneToLegacyShape, mapLegacyPayloadToApi, type ApiZone } from '../lib/zones-adapter';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function normalizeList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: Record<string, unknown>[] }).results;
  }
  return [];
}

function buildHeaders(householdId: string | null, write = false): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (householdId) headers['X-Household-Id'] = householdId;
  if (write) {
    headers['Content-Type'] = 'application/json';
    const csrf = getCookie('csrftoken');
    if (csrf) headers['X-CSRFToken'] = csrf;
  }

  return headers;
}

function resolveColorForZone({
  zone,
  parentZone,
  requestedColor,
}: {
  zone?: Zone | null;
  parentZone: Zone | null;
  requestedColor?: string | null;
}) {
  if (!parentZone) {
    return ROOT_ZONE_COLOR;
  }
  if (!parentZone.parent_id) {
    const base = requestedColor ?? zone?.color ?? DEFAULT_FIRST_LEVEL_COLOR;
    return normalizeHexColor(base, DEFAULT_FIRST_LEVEL_COLOR);
  }
  const parentColor = parentZone.color ?? DEFAULT_FIRST_LEVEL_COLOR;
  return lightenHexColor(parentColor);
}

export function useZones({ householdId, initialZones }: ZonesPageProps) {
  const initialMapped = useMemo<Zone[]>(
    () =>
      initialZones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        parent_id: zone.parentId,
        note: '',
        surface: null,
        color: zone.color,
        full_path: zone.fullPath,
      })),
    [initialZones]
  );

  const [zonesState, setZonesState] = useState<Zone[]>(initialMapped);
  const zonesRef = useRef<Zone[]>(initialMapped);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const setZones = useCallback((updater: Zone[] | ((prev: Zone[]) => Zone[])) => {
    setZonesState((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: Zone[]) => Zone[])(prev) : updater;
      zonesRef.current = next;
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    if (!householdId) {
      setZones([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/zones/', {
        method: 'GET',
        credentials: 'same-origin',
        headers: buildHeaders(householdId),
      });
      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      const list = normalizeList(payload).map((item) => mapApiZoneToLegacyShape(item as ApiZone));
      setZones(list);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load zones';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [householdId, setZones]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createZone = useCallback(
    async (payload: ZoneMutationPayload) => {
      if (!householdId) throw new Error('No household selected');

      const parentZone = payload.parent_id ? zonesRef.current.find((z) => z.id === payload.parent_id) ?? null : null;
      if (payload.parent_id && !parentZone) {
        throw new Error('Selected parent zone no longer exists.');
      }
      if (parentZone && !parentZone.parent_id && !payload.color) {
        throw new Error('Color is required for first-level zones.');
      }

      const resolvedColor = resolveColorForZone({
        zone: null,
        parentZone,
        requestedColor: payload.color ?? null,
      });

      const response = await fetch('/api/zones/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: buildHeaders(householdId, true),
        body: JSON.stringify({
          ...mapLegacyPayloadToApi(payload),
          color: resolvedColor,
          household_id: householdId,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `API error ${response.status}`);
      }

      const created = mapApiZoneToLegacyShape((await response.json()) as ApiZone);
      setZones((prev) => [...prev, created]);
      return created;
    },
    [householdId, setZones]
  );

  const updateZone = useCallback(
    async (id: string, payload: ZoneMutationPayload) => {
      if (!householdId) throw new Error('No household selected');

      const existing = zonesRef.current.find((zone) => zone.id === id);
      if (!existing) {
        throw new Error('Zone not found');
      }

      const nextParentId = payload.parent_id;
      const parentZone = nextParentId ? zonesRef.current.find((z) => z.id === nextParentId) ?? null : null;
      if (nextParentId && !parentZone) {
        throw new Error('Selected parent zone no longer exists.');
      }

      const resolvedColor = resolveColorForZone({
        zone: existing,
        parentZone,
        requestedColor: payload.color ?? existing.color,
      });

      const response = await fetch(`/api/zones/${id}/`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: buildHeaders(householdId, true),
        body: JSON.stringify({
          ...mapLegacyPayloadToApi(payload),
          color: resolvedColor,
          last_known_updated_at: existing.updated_at ?? undefined,
        }),
      });

      if (!response.ok) {
        let detail = `API error ${response.status}`;
        try {
          const json = (await response.json()) as { detail?: string };
          detail = json.detail ?? detail;
        } catch {
          // ignore parsing failure
        }
        throw new Error(detail);
      }

      const updated = mapApiZoneToLegacyShape((await response.json()) as ApiZone);
      setZones((prev) => prev.map((zone) => (zone.id === id ? updated : zone)));
      return updated;
    },
    [householdId, setZones]
  );

  const deleteZone = useCallback(
    async (id: string) => {
      if (!householdId) throw new Error('No household selected');
      const response = await fetch(`/api/zones/${id}/`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: buildHeaders(householdId, true),
      });

      if (!response.ok) {
        let detail = `API error ${response.status}`;
        try {
          const json = (await response.json()) as { detail?: string };
          detail = json.detail ?? detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }

      setZones((prev) => prev.filter((zone) => zone.id !== id));
    },
    [householdId, setZones]
  );

  return { zones: zonesState, loading, error, setError, reload, createZone, updateZone, deleteZone };
}
