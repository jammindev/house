export type Zone = {
    id: string;
    name: string;
    created_by?: string;
    parent_id?: string | null;
    note?: string | null;
    surface?: number | null;
    color: string;
};

export type ZoneDetail = Zone & {
    household_id: string;
    created_at?: string | null;
    parent?: {
        id: string;
        name: string;
        color?: string | null;
    } | null;
};

export type ZoneStats = {
    totalCount: number;
    rootCount: number;
    childCount: number;
    surfaceSum: number;
    hasSurfaceData: boolean;
};

export type ZoneTree = {
    zonesById: Map<string, Zone>;
    sortedZones: Zone[];
    zoneDepths: Map<string, number>;
    zoneStats: ZoneStats;
};
