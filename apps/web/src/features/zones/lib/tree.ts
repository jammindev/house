import type { Zone, ZoneTree } from "../types";

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
    zones.forEach((z) => byId.set(z.id, z));

    const childByParent = new Map<string | null, Zone[]>();
    zones.forEach((z) => {
        const key = z.parent_id ?? null;
        const list = childByParent.get(key) ?? [];
        list.push(z);
        childByParent.set(key, list);
    });

    childByParent.forEach((list) => {
        list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
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
        if (children) children.forEach((c) => visit(c, depth + 1));
    };

    const roots = (childByParent.get(null) ?? []).slice().sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    roots.forEach((r) => visit(r, 0));

    // rattrapage si parent manquant
    zones.forEach((z) => {
        if (!visited.has(z.id)) visit(z, 0);
    });

    let surfaceSum = 0;
    let hasSurfaceData = false;
    let rootCount = 0;

    zones.forEach((z) => {
        const hasParent = !!(z.parent_id && byId.get(z.parent_id) && byId.get(z.parent_id)!.id !== z.id);
        if (!hasParent) rootCount += 1;
        if (typeof z.surface === "number" && !Number.isNaN(z.surface)) {
            surfaceSum += z.surface;
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
    const prefix = depth > 0 ? `${Array(depth).fill("--").join("")} ` : "";
    return `${prefix}${zone.name}`;
}