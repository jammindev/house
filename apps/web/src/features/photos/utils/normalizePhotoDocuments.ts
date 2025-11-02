import { normalizeDocuments } from "@documents/utils/normalizeDocuments";
import type { PhotoDocument, SupabasePhotoDocumentRow } from "@photos/types";

export function normalizePhotoDocuments(rows: SupabasePhotoDocumentRow[] | null | undefined): PhotoDocument[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const baseDocuments = normalizeDocuments(rows);

  return baseDocuments.map((document, index) => {
    const row = rows[index];
    const zones =
      (row.zone_documents ?? [])
        .filter((zoneLink) => Boolean(zoneLink.zone_id))
        .map((zoneLink) => ({
          id: zoneLink.zone_id,
          name: zoneLink.zone?.name ?? null,
        })) ?? [];

    return {
      ...document,
      zones,
    };
  });
}
