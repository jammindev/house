import type { DocumentLink, DocumentWithLinks, SupabaseDocumentRow } from "@documents/types";

export function normalizeDocuments(rows: SupabaseDocumentRow[] | null | undefined): DocumentWithLinks[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const { interaction_documents: interactionDocuments, ...document } = row;
    const links: DocumentLink[] = (interactionDocuments ?? []).map((link) => ({
      interactionId: link.interaction_id,
      subject: link.interaction?.subject ?? null,
    }));

    return {
      ...document,
      links,
    };
  });
}
