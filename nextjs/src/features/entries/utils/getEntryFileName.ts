import type { EntryFile } from "@entries/types";

/**
 * Returns the preferred display name for an entry file. Falls back to the storage path segment.
 */
export function getEntryFileName(file: EntryFile): string {
  const metadata = file.metadata ?? undefined;
  const customName = typeof metadata?.customName === "string" ? metadata.customName : undefined;
  if (customName?.trim()) return customName.trim();

  const lastSegment = file.storage_path.split("/").pop() ?? "";
  const [_prefix, ...rest] = lastSegment.split("_");
  const fallback = rest.length ? rest.join("_") : lastSegment;
  return fallback || "file";
}
