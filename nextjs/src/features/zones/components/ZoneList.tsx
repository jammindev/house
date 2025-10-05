"use client";
import ZoneItem from "./ZoneItem";
import type { Zone } from "../types";

interface Props {
    zones: Zone[];
    zonesById: Map<string, Zone>;
    zoneDepths: Map<string, number>;
    numberFormatter: Intl.NumberFormat;
    t: (key: string, args?: Record<string, any>) => string;
    onEdit: (id: string, payload: { name: string; parent_id: string | null; note: string | null; surface: number | null }) => Promise<void>;
    onAskDelete: (z: Zone) => void;
    deletingId?: string | null;
}

export default function ZoneList({ zones, zonesById, zoneDepths, numberFormatter, t, onEdit, onAskDelete, deletingId }: Props) {
    return (
        <ul className="space-y-3">
            {zones.map((z) => (
                <ZoneItem
                    key={z.id}
                    zone={z}
                    zonesById={zonesById}
                    sortedZones={zones}
                    zoneDepths={zoneDepths}
                    numberFormatter={numberFormatter}
                    t={t}
                    onEdit={onEdit}
                    onAskDelete={onAskDelete}
                    deletingId={deletingId}
                />
            ))}
        </ul>
    );
}
