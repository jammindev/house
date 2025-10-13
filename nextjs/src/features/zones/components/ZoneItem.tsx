// nextjs/src/features/zones/components/ZoneItem.tsx
"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Zone } from "../types";
import { formatZoneOptionLabel } from "../lib/tree";
interface Props {
    zone: Zone;
    zonesById: Map<string, Zone>;
    sortedZones: Zone[];
    zoneDepths: Map<string, number>;
    numberFormatter: Intl.NumberFormat;
    t: (key: string, args?: Record<string, any>) => string;
    onEdit: (id: string, payload: { name: string; parent_id: string | null; note: string | null; surface: number | null }) => Promise<void>;
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
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(zone.name);
    const [parentId, setParentId] = useState<string | "">(zone.parent_id ?? "");
    const [surface, setSurface] = useState(
        typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? String(zone.surface) : ""
    );
    const [note, setNote] = useState(zone.note ?? "");
    const [saving, setSaving] = useState(false);

    const depth = zoneDepths.get(zone.id) ?? 0;
    const parent = useMemo(() => (zone.parent_id ? zonesById.get(zone.parent_id) ?? null : null), [zonesById, zone.parent_id]);
    const surfaceText = typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? numberFormatter.format(zone.surface) : null;

    const handleSave = async () => {
        const nameTrim = name.trim();
        if (!nameTrim) return;
        const sTrim = surface.trim();
        const sVal = sTrim ? Number(sTrim) : null;
        if (sTrim && (Number.isNaN(sVal) || sVal < 0)) throw new Error(t("zones.invalidSurface"));
        const noteVal = note.trim() || null;
        setSaving(true);
        try {
            await onEdit(zone.id, { name: nameTrim, parent_id: parentId || null, note: noteVal, surface: sVal });
            setIsEditing(false);
        } finally {
            setSaving(false);
        }
    };
    return (
        <motion.li
            layout
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={clsx(
                "group rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-slate-300",
                depth > 0 && "bg-slate-50",
                isFirstChildOfRoot && "mt-4"
            )}
            style={{ marginLeft: depth ? depth * 18 : undefined, overflow: "hidden" }}
        >
            {isEditing ? (
                <div className="flex flex-col gap-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="md:flex-1" />
                        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                            <option value="">{t("zones.noParent")}</option>
                            {sortedZones
                                .filter((zz) => zz.id !== zone.id)
                                .map((zz) => (
                                    <option key={zz.id} value={zz.id}>
                                        {formatZoneOptionLabel(zz, zoneDepths)}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[200px]">
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={surface}
                            onChange={(e) => setSurface(e.target.value)}
                            placeholder={t("zones.surfacePlaceholder")}
                        />
                    </div>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("zones.notePlaceholder")} rows={3} />
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
                            {saving ? t("common.saving") : t("common.save")}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                            {t("common.cancel")}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-[44px] items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center">
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={onToggleCollapse}
                                aria-label={collapsed ? t("zones.expandZone") : t("zones.collapseZone")}
                                className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100"
                            >
                                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                        ) : (
                            <span className="inline-block h-7 w-7" />
                        )}
                    </div>
                    <div className="flex flex-1 items-center gap-3 overflow-hidden">
                        <span className="truncate font-medium text-slate-900">{zone.name}</span>
                        {surfaceText ? (
                            <span className="whitespace-nowrap text-xs text-slate-500">{t("zones.surfaceValue", { value: surfaceText })}</span>
                        ) : null}
                        {zone.note ? (
                            <span className="truncate text-xs text-slate-500">{t("zones.noteValue", { note: zone.note })}</span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setIsEditing(true)}
                            aria-label={t("zones.edit")}
                            className="h-7 w-7 text-slate-500 hover:text-slate-900"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-600"
                            onClick={() => onAskDelete(zone)}
                            disabled={deletingId === zone.id}
                            aria-label={deletingId === zone.id ? t("common.deleting") : t("common.delete")}
                        >
                            {deletingId === zone.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>
            )}
        </motion.li>
    );
}
