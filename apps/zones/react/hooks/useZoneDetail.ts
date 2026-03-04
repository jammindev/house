import { useCallback, useEffect, useState } from 'react';

import { mapApiPhoto, mapApiZoneToZoneDetail, type ApiZone } from '../lib/zones-adapter';
import type { ZoneDetail, ZoneDetailPageProps, ZonePhoto } from '../types/zones';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=').slice(1).join('='));
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

export function useZoneDetail(props: ZoneDetailPageProps) {
  const [zone, setZone] = useState<ZoneDetail | null>(
    props.initialZone
      ? {
          id: props.initialZone.id,
          name: props.initialZone.name,
          parent_id: props.initialZone.parentId,
          note: props.initialZone.note ?? '',
          surface: props.initialZone.surface ?? null,
          color: props.initialZone.color ?? '#f4f4f5',
          household_id: props.householdId ?? '',
          parent: props.initialZone.parentId
            ? {
                id: props.initialZone.parentId,
                name: props.initialZone.parentName ?? '',
                color: null,
              }
            : null,
          updated_at: props.initialZone.updatedAt ?? undefined,
        }
      : null
  );
  const [photos, setPhotos] = useState<ZonePhoto[]>(props.initialPhotos ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!props.zoneId) {
      setZone(null);
      setPhotos([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [zoneResponse, photosResponse] = await Promise.all([
        fetch(`/api/zones/${props.zoneId}/`, {
          method: 'GET',
          credentials: 'same-origin',
          headers: buildHeaders(props.householdId),
        }),
        fetch(`/api/zones/${props.zoneId}/photos/`, {
          method: 'GET',
          credentials: 'same-origin',
          headers: buildHeaders(props.householdId),
        }),
      ]);

      if (!zoneResponse.ok) {
        throw new Error(`API error ${zoneResponse.status}`);
      }
      if (!photosResponse.ok) {
        throw new Error(`API error ${photosResponse.status}`);
      }

      const zonePayload = (await zoneResponse.json()) as ApiZone;
      const mapped = mapApiZoneToZoneDetail({
        ...zonePayload,
        parent_name: zone?.parent?.name ?? props.initialZone?.parentName ?? null,
      });
      setZone(mapped);

      const photosPayload = (await photosResponse.json()) as Array<Record<string, unknown>>;
      setPhotos(Array.isArray(photosPayload) ? photosPayload.map((item) => mapApiPhoto(item)) : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load zone details');
    } finally {
      setLoading(false);
    }
  }, [props.zoneId, props.householdId, props.initialZone?.parentName, zone?.parent?.name]);

  useEffect(() => {
    void load();
  }, [load]);

  const attachPhoto = useCallback(
    async (documentId: string, note = '') => {
      if (!props.zoneId) return;
      const response = await fetch(`/api/zones/${props.zoneId}/attach_photo/`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: buildHeaders(props.householdId, true),
        body: JSON.stringify({ document_id: documentId, note }),
      });

      if (!response.ok) {
        let detail = `API error ${response.status}`;
        try {
          const payload = (await response.json()) as { detail?: string };
          detail = payload.detail ?? detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }

      const created = mapApiPhoto((await response.json()) as Record<string, unknown>);
      setPhotos((prev) => [created, ...prev]);
      return created;
    },
    [props.zoneId, props.householdId]
  );

  return {
    zone,
    photos,
    loading,
    error,
    reload: load,
    attachPhoto,
  };
}
