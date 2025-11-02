import type { Document } from "@interactions/types";

export function getDocumentFileSize(file: Document): number | null {
  const size = file.metadata && typeof file.metadata.size === "number" ? file.metadata.size : null;
  return size !== null && Number.isFinite(size) && size > 0 ? size : null;
}

export function formatFileSize(bytes?: number | null): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 || unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}
