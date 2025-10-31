// nextjs/src/features/zones/components/ZoneList.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import ZoneItem from "./ZoneItem";
import type { Zone } from "../types";

interface Props {
    zones: Zone[];
    zonesById: Map<string, Zone>;
    zoneDepths: Map<string, number>;
    numberFormatter: Intl.NumberFormat;
    t: (key: string, args?: Record<string, string | number>) => string;
    onEdit: (id: string, payload: { name: string; parent_id: string | null; note: string | null; surface: number | null; color?: string | null }) => Promise<void>;
    onAskDelete: (z: Zone) => void;
    deletingId?: string | null;
}

export default function ZoneList({ zones, zonesById, zoneDepths, numberFormatter, t, onEdit, onAskDelete, deletingId }: Props) {
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

    const childrenByParent = useMemo(() => {
        const map = new Map<string, Zone[]>();
        zones.forEach((zone) => {
            if (!zone.parent_id) return;
            const list = map.get(zone.parent_id) ?? [];
            list.push(zone);
            map.set(zone.parent_id, list);
        });
        return map;
    }, [zones]);

    const { rootIds, rootFirstChildSet } = useMemo(() => {
        const roots = zones.filter((zone) => !zone.parent_id);
        const rootIdSet = new Set<string>(roots.map((zone) => zone.id));
        const firstChildIds: string[] = [];
        const seenParents = new Set<string>();
        zones.forEach((zone) => {
            if (!zone.parent_id) return;
            if (!rootIdSet.has(zone.parent_id)) return;
            if (seenParents.has(zone.parent_id)) return;
            firstChildIds.push(zone.id);
            seenParents.add(zone.parent_id);
        });

        return {
            rootIds: rootIdSet,
            rootFirstChildSet: new Set<string>(firstChildIds),
        };
    }, [zones]);

    // 👉 Par défaut : on replie toutes les zones AVEC enfants, SAUF les racines
    const defaultCollapsed = useMemo(() => {
        const set = new Set<string>();
        zones.forEach((zone) => {
            if (!zone.parent_id) return; // ne pas replier les racines
            const hasChildren = (childrenByParent.get(zone.id) ?? []).length > 0;
            if (hasChildren) set.add(zone.id);
        });
        return set;
    }, [zones, childrenByParent]);

    // Si la liste des zones change (ex: chargement, refresh), on repart de l'état "tout replié par défaut"
    useEffect(() => {
        setCollapsed(defaultCollapsed);
    }, [defaultCollapsed]);

    const toggleCollapse = useCallback((zoneId: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(zoneId)) next.delete(zoneId);
            else next.add(zoneId);
            return next;
        });
    }, []);

    const isHidden = useCallback(
        (zone: Zone) => {
            let parentId = zone.parent_id;
            while (parentId) {
                if (collapsed.has(parentId)) return true;
                const parent = zonesById.get(parentId);
                parentId = parent?.parent_id ?? null;
            }
            return false;
        },
        [collapsed, zonesById]
    );

    let firstRendered = true;

    return (
        <ul>
            {zones.map((zone) => {
                if (rootIds.has(zone.id)) return null;     // on ne rend pas les racines
                if (isHidden(zone)) return null;           // on masque si un ancêtre est replié
                const hasChildren = (childrenByParent.get(zone.id) ?? []).length > 0;
                const isFirstChildOfRoot = rootFirstChildSet.has(zone.id);
                const applyExtraMargin = !firstRendered && isFirstChildOfRoot;

                const item = (
                    <ZoneItem
                        key={zone.id}
                        zone={zone}
                        zonesById={zonesById}
                        sortedZones={zones}
                        zoneDepths={zoneDepths}
                        numberFormatter={numberFormatter}
                        t={t}
                        onEdit={onEdit}
                        onAskDelete={onAskDelete}
                        deletingId={deletingId}
                        hasChildren={hasChildren}
                        collapsed={collapsed.has(zone.id)}
                        onToggleCollapse={hasChildren ? () => toggleCollapse(zone.id) : undefined}
                        isFirstChildOfRoot={applyExtraMargin}
                    />
                );
                firstRendered = false;
                return item;
            })}
        </ul>
    );
}
