"use client";
import { Layers, Ruler, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { ZoneStats } from "../types";

interface Props {
    stats: ZoneStats;
    t: (key: string, args?: Record<string, any>) => string;
    formattedSurfaceTotal: string | null;
}

export default function ZoneStats({ stats, t, formattedSurfaceTotal }: Props) {
    const tiles: Array<{
        key: string;
        icon: LucideIcon;
        iconClass: string;
        label: string;
        value: string;
        helper?: string;
    }> = [
            {
                key: "total",
                icon: Layers,
                iconClass: "text-indigo-600",
                label: t("zones.stats.totalLabel"),
                value: String(stats.totalCount),
            },
            {
                key: "root",
                icon: Layers,
                iconClass: "text-emerald-600",
                label: t("zones.stats.rootLabel"),
                value: String(stats.rootCount),
                helper: stats.childCount > 0 ? t("zones.stats.nestedHelper", { count: stats.childCount }) : undefined,
            },

            {
                key: "surface",
                icon: Ruler,
                iconClass: "text-amber-600",
                label: t("zones.stats.surfaceLabel"),
                value: stats.hasSurfaceData && formattedSurfaceTotal ? t("zones.stats.surfaceValue", { value: formattedSurfaceTotal }) : "--",
                helper: stats.hasSurfaceData ? undefined : t("zones.stats.surfaceFallback"),
            },
        ];

    return (
        <div className="mb-6 grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 md:grid-cols-3">
            {tiles.map((tile) => {
                const Icon = tile.icon;
                return (
                    <div key={tile.key} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                            <Icon className={clsx("h-5 w-5", tile.iconClass)} />
                        </div>
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tile.label}</div>
                            <div className="text-lg font-semibold text-gray-900">{tile.value}</div>
                            {tile.helper ? <div className="text-xs text-gray-500">{tile.helper}</div> : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}