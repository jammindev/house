import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchZones,
  fetchZone,
  createZone,
  updateZone,
  deleteZone,
  type Zone,
  type ZonePayload,
} from '@/lib/api/zones';

export const zoneKeys = {
  all: ['zones'] as const,
  list: () => [...zoneKeys.all, 'list'] as const,
  detail: (id: string) => [...zoneKeys.all, 'detail', id] as const,
};

export function useZones() {
  return useQuery({
    queryKey: zoneKeys.list(),
    queryFn: fetchZones,
  });
}

export function useZone(id: string) {
  return useQuery({
    queryKey: zoneKeys.detail(id),
    queryFn: () => fetchZone(id),
    enabled: !!id,
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ZonePayload) => createZone(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: zoneKeys.all }),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ZonePayload> }) =>
      updateZone(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: zoneKeys.all }),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: zoneKeys.all }),
  });
}

// ── Tree helpers (used by components) ────────────────────────────────────────

/**
 * Given a flat list of zones, compute a depth-first ordered list
 * (roots first, then children indented) along with a depth map.
 */
export function buildZoneTree(zones: Zone[]): {
  sortedZones: Zone[];
  depthMap: Map<string, number>;
} {
  if (zones.length === 0) return { sortedZones: [], depthMap: new Map() };

  const byId = new Map<string, Zone>();
  const childrenByParent = new Map<string | null, Zone[]>();

  for (const zone of zones) {
    byId.set(zone.id, zone);
  }

  for (const zone of zones) {
    const parentId = zone.parentId ?? zone.parent ?? null;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(zone);
    childrenByParent.set(parentId, list);
  }

  // Sort each group alphabetically
  childrenByParent.forEach((list) =>
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  );

  const depthMap = new Map<string, number>();
  const sortedZones: Zone[] = [];
  const visited = new Set<string>();

  const visit = (zone: Zone, depth: number) => {
    if (visited.has(zone.id)) return;
    visited.add(zone.id);
    depthMap.set(zone.id, depth);
    sortedZones.push(zone);
    const children = childrenByParent.get(zone.id) ?? [];
    for (const child of children) visit(child, depth + 1);
  };

  const roots = (childrenByParent.get(null) ?? []).slice().sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  for (const root of roots) visit(root, 0);

  // Handle orphans (parent missing from list)
  for (const zone of zones) {
    if (!visited.has(zone.id)) visit(zone, 0);
  }

  return { sortedZones, depthMap };
}

/**
 * Returns the set of zone ids that are descendants of `zoneId` (inclusive).
 */
export function getDescendantIds(zoneId: string, zones: Zone[]): Set<string> {
  const childrenByParent = new Map<string, Zone[]>();
  for (const zone of zones) {
    const pid = zone.parentId ?? zone.parent ?? null;
    if (!pid) continue;
    const list = childrenByParent.get(pid) ?? [];
    list.push(zone);
    childrenByParent.set(pid, list);
  }

  const result = new Set<string>([zoneId]);
  const queue = [zoneId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      result.add(child.id);
      queue.push(child.id);
    }
  }
  return result;
}
