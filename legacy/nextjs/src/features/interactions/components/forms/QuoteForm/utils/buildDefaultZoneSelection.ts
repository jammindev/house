import type { ZoneOption } from "@interactions/types";

export const buildDefaultZoneSelection = (selectedZones: string[] | undefined, zones: ZoneOption[]) => {
    const hasDefaultZone = (selectedZones?.length ?? 0) > 0;
    const rootZoneId = zones.find((zone) => !zone.parent_id)?.id ?? null;
    const defaultZoneSelection = hasDefaultZone ? selectedZones ?? [] : rootZoneId ? [rootZoneId] : [];

    return { hasDefaultZone, rootZoneId, defaultZoneSelection };
};
