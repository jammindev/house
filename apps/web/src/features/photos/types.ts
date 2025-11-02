import type { DocumentWithLinks, SupabaseDocumentRow } from "@documents/types";

export type PhotoZoneLink = {
  id: string;
  name: string | null;
};

export type PhotoDocument = DocumentWithLinks & {
  zones: PhotoZoneLink[];
};

type SupabaseZoneLink = {
  zone_id: string;
  zone: {
    id: string;
    name: string | null;
  } | null;
};

export type SupabasePhotoDocumentRow = SupabaseDocumentRow & {
  zone_documents?: SupabaseZoneLink[] | null;
};
