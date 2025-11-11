// nextjs/src/features/zones/components/ZoneItem.tsx
"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
// removed framer-motion presence animation
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Zone } from "../types";
import { getZoneDisplayColor } from "@zones/lib/colors";
import ZoneEditDialog from "./ZoneEditDialog";
interface Props {
    zone: Zone;
    zonesById: Map<string, Zone>;
    sortedZones: Zone[];
    zoneDepths: Map<string, number>;
    numberFormatter: Intl.NumberFormat;
    t: (key: string, args?: Record<string, string | number>) => string;
    onEdit: (id: string, payload: { name: string; parent_id: string | null; note: string | null; surface: number | null; color?: string | null }) => Promise<void>;
    onAskDelete: (z: Zone) => void;
    deletingId?: string | null;
    hasChildren?: boolean;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    isFirstChildOfRoot?: boolean;
}

export default function ZoneItem({
    zone,
    zonesById,
    sortedZones,
    zoneDepths,
    numberFormatter,
    t,
    onEdit,
    onAskDelete,
    deletingId,
    hasChildren = false,
    collapsed = false,
    onToggleCollapse,
    isFirstChildOfRoot = false,
}: Props) {
    const [editOpen, setEditOpen] = useState(false);

    const depth = zoneDepths.get(zone.id) ?? 0;
    const surfaceText = typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? numberFormatter.format(zone.surface) : null;
    const displayColor = useMemo(() => getZoneDisplayColor(zone, zonesById), [zone, zonesById]);

    return (
        <li
            className={clsx(
                "group rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-slate-300",
                depth > 0 && "bg-slate-50",
                isFirstChildOfRoot && "mt-4"
            )}
            style={{
                marginLeft: depth ? (depth - 1) * 18 : undefined,
                overflow: "hidden",
                borderLeftWidth: 6,
                borderLeftColor: displayColor,
            }}
        >
            <div className="flex min-h-[48px] items-center gap-2 sm:gap-3">
                <div className="flex h-9 w-9 items-center justify-center sm:h-8 sm:w-8">
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            aria-label={collapsed ? t("zones.expandZone") : t("zones.collapseZone")}
                            className="flex h-9 w-9 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 sm:h-7 sm:w-7"
                        >
                            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                    ) : (
                        <span className="inline-block h-9 w-9 sm:h-7 sm:w-7" />
                    )}
                </div>
                <Link
                    href={`/app/zones/${zone.id}`}
                    className="flex flex-1 items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition hover:bg-slate-100"
                >
                    <span className="flex flex-1 items-center gap-2 truncate text-sm font-medium text-slate-900 sm:text-base">
                        <span
                            className="h-3 w-3 rounded-full border border-white shadow-inner shadow-white"
                            style={{ backgroundColor: displayColor }}
                        />
                        <span className="truncate">{zone.name}</span>
                    </span>
                    {surfaceText ? (
                        <span className="whitespace-nowrap text-xs text-slate-500 sm:text-sm">
                            {t("zones.surfaceValue", { value: surfaceText })}
                        </span>
                    ) : null}
                </Link>
                <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">{t("zones.edit")}</span>
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onAskDelete(zone)}
                        disabled={deletingId === zone.id}
                    >
                        {deletingId === zone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span className="sr-only">{t("common.delete")}</span>
                    </Button>
                </div>
            </div>
            <ZoneEditDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                zone={zone}
                zones={sortedZones}
                zonesById={zonesById}
                zoneDepths={zoneDepths}
                t={t}
                onSave={onEdit}
            />
        </li>
    );
}
