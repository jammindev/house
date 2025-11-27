import type { LocalFile } from "@interactions/components/forms/common/DocumentsFields";

// Simple in-memory stash to carry staged files across the redirect.
const store = new Map<string, LocalFile[]>();

export const storeDraftFiles = (id: string, files: LocalFile[]) => {
  if (!files.length) return;
  store.set(id, files);
};

export const consumeDraftFiles = (id?: string | null): LocalFile[] => {
  if (!id) return [];
  const files = store.get(id) ?? [];
  store.delete(id);
  return files;
};
