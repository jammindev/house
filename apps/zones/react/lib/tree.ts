import type { Zone, ZoneTree } from '../types/zones';

export function computeZoneTree(zones: Zone[]): ZoneTree {
  if (zones.length === 0) {
    return {
      zonesById: new Map<string, Zone>(),
      sortedZones: [],
      zoneDepths: new Map<string, number>(),
      zoneStats: {
        totalCount: 0,
        rootCount: 0,
        childCount: 0,
        surfaceSum: 0,
        hasSurfaceData: false,
      },
    };
  }

  const byId = new Map<string, Zone>();
  zones.forEach((zone) => byId.set(zone.id, zone));

  const childByParent = new Map<string | null, Zone[]>();
  zones.forEach((zone) => {
    const key = zone.parent_id ?? null;
    const list = childByParent.get(key) ?? [];
    list.push(zone);
    childByParent.set(key, list);
  });

  childByParent.forEach((list) => {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  });

  const zoneDepths = new Map<string, number>();
  const ordered: Zone[] = [];
  const visited = new Set<string>();

  const visit = (zone: Zone, depth: number) => {
    if (visited.has(zone.id)) return;
    visited.add(zone.id);
    zoneDepths.set(zone.id, depth);
    ordered.push(zone);
    const children = childByParent.get(zone.id);
    if (children) children.forEach((child) => visit(child, depth + 1));
  };

  const roots = (childByParent.get(null) ?? []).slice().sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  roots.forEach((root) => visit(root, 0));

  zones.forEach((zone) => {
    if (!visited.has(zone.id)) visit(zone, 0);
  });

  let surfaceSum = 0;
  let hasSurfaceData = false;
  let rootCount = 0;

  zones.forEach((zone) => {
    const hasParent = !!(zone.parent_id && byId.get(zone.parent_id) && byId.get(zone.parent_id)!.id !== zone.id);
    if (!hasParent) rootCount += 1;
    if (typeof zone.surface === 'number' && !Number.isNaN(zone.surface)) {
      surfaceSum += zone.surface;
      hasSurfaceData = true;
    }
  });

  return {
    zonesById: byId,
    sortedZones: ordered,
    zoneDepths,
    zoneStats: {
      totalCount: zones.length,
      rootCount,
      childCount: zones.length - rootCount,
      surfaceSum,
      hasSurfaceData,
    },
  };
}

export function formatZoneOptionLabel(zone: Zone, zoneDepths: Map<string, number>) {
  const depth = zoneDepths.get(zone.id) ?? 0;
  const prefix = depth > 0 ? `${Array(depth).fill('--').join('')} ` : '';
  return `${prefix}${zone.name}`;
}
