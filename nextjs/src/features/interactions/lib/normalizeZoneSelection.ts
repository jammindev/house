import { ZoneOption } from "../types";

export function normalizeZoneSelection(
  selectedIds: string[],
  zones: ZoneOption[]
): string[] {
  if (selectedIds.length === 0) {
    return [];
  }

  const parentMap = new Map<string, string>();
  for (const zone of zones) {
    if (zone.parent_id) {
      parentMap.set(zone.id, zone.parent_id);
    }
  }

  const result = new Set(selectedIds);
  for (const id of selectedIds) {
    let parentId = parentMap.get(id);
    while (parentId) {
      if (result.has(parentId)) {
        result.delete(parentId);
      }
      parentId = parentMap.get(parentId);
    }
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedIds) {
    if (result.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  if (ordered.length === result.size) {
    return ordered;
  }

  for (const id of result) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  return ordered;
}
