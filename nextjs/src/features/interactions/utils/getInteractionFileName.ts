import type { Document } from "@interactions/types";

/**
 * Returns the preferred display name for an entry file. Falls back to the storage path segment.
 */
export function getInteractionFileName(file: Document): string {
  const metadata = file.metadata ?? undefined;
  const customName = typeof metadata?.customName === "string" ? metadata.customName : undefined;
  if (customName?.trim()) return customName.trim();

  if (file.name?.trim()) {
    return file.name.trim();
  }

  const lastSegment = file.file_path.split("/").pop() ?? "";
  const [, ...rest] = lastSegment.split("_");
  const fallback = rest.length ? rest.join("_") : lastSegment;
  return fallback || "file";
}
