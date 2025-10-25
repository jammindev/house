// nextjs/src/features/zones/components/ZoneItem.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Zone } from "../types";
import { formatZoneOptionLabel } from "../lib/tree";
import { DEFAULT_FIRST_LEVEL_COLOR, getZoneDisplayColor, normalizeHexColor } from "@zones/lib/colors";
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
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(zone.name);
    const [parentId, setParentId] = useState<string | "">(zone.parent_id ?? "");
    const [surface, setSurface] = useState(
        typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? String(zone.surface) : ""
    );
    const [note, setNote] = useState(zone.note ?? "");
    const [colorValue, setColorValue] = useState(zone.color || DEFAULT_FIRST_LEVEL_COLOR);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const depth = zoneDepths.get(zone.id) ?? 0;
    const parent = useMemo(() => (zone.parent_id ? zonesById.get(zone.parent_id) ?? null : null), [zonesById, zone.parent_id]);
    const draftParent = useMemo(
        () => (parentId ? sortedZones.find((z) => z.id === parentId) ?? null : null),
        [parentId, sortedZones]
    );
    const surfaceText = typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? numberFormatter.format(zone.surface) : null;
    const isDraftFirstLevel = !!(draftParent && !draftParent.parent_id);
    const displayColor = useMemo(() => getZoneDisplayColor(zone, zonesById), [zone, zonesById]);

    useEffect(() => {
        setColorValue(zone.color || DEFAULT_FIRST_LEVEL_COLOR);
    }, [zone.color]);

    useEffect(() => {
        if (collapsed) setExpanded(false);
    }, [collapsed]);

    const handleSave = async () => {
        const nameTrim = name.trim();
        if (!nameTrim) return;
        const sTrim = surface.trim();
        let sVal: number | null = null;
        if (sTrim) {
            const parsed = Number(sTrim);
            if (Number.isNaN(parsed) || parsed < 0) throw new Error(t("zones.invalidSurface"));
            sVal = parsed;
        }
        const noteVal = note.trim() || null;
        const colorPayload = isDraftFirstLevel ? normalizeHexColor(colorValue) : null;
        if (isDraftFirstLevel && !colorPayload) {
            throw new Error(t("zones.colorRequired"));
        }
        setSaving(true);
        try {
            await onEdit(zone.id, {
                name: nameTrim,
                parent_id: parentId || null,
                note: noteVal,
                surface: sVal,
                color: colorPayload ?? undefined,
            });
            setIsEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleDetails = () => {
        if (isEditing) return;
        setExpanded((prev) => !prev);
    };

    const handleEditClick = () => {
        setExpanded(true);
        setIsEditing(true);
    };

    return (
        <motion.li
            layout
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
            transition={{
                duration: 0.10,
                ease: "easeOut",
                layout: { type: "spring", duration: 0.10, ease: "easeInOut" },
            }}
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
                    {isDraftFirstLevel ? (
                        <div className="flex flex-col gap-1 rounded-md border border-indigo-100 bg-white/70 p-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{t("zones.colorLabel")}</label>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <input
                                    type="color"
                                    value={colorValue}
                                    onChange={(e) => setColorValue(e.target.value)}
                                    className="h-12 w-full rounded-md border border-indigo-200 bg-white p-1 md:h-10 md:w-40"
                                    aria-label={t("zones.colorLabel")}
                                />
                                <p className="text-xs text-slate-500 md:flex-1">{t("zones.colorHelper")}</p>
                            </div>
                        </div>
                    ) : null}
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
                <div className="flex flex-col">
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
                        <Button
                            variant="ghost"
                            onClick={handleToggleDetails}
                            className="flex flex-1 items-start justify-between gap-1 rounded-md px-2 py-2 text-left transition hover:bg-slate-100 sm:flex-row sm:items-center sm:gap-3"
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
                        </Button>
                    </div>
                    <AnimatePresence initial={false}>
                        {expanded && (
                            <motion.div
                                key="zone-details"
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                className="overflow-hidden"
                            >
                                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 sm:text-sm">
                                    {parent ? (
                                        <div className="mb-2 text-slate-500">{t("zones.childOf", { parent: parent.name })}</div>
                                    ) : null}
                                    {zone.note ? (
                                        <div className="whitespace-pre-wrap text-slate-600">{zone.note}</div>
                                    ) : (
                                        <div className="italic text-slate-400">{t("zones.noteEmpty")}</div>
                                    )}
                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Button size="sm" variant="outline" onClick={handleEditClick} className="w-full sm:w-auto">
                                            <Pencil className="mr-1 h-3.5 w-3.5" />
                                            {t("zones.edit")}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => onAskDelete(zone)}
                                            disabled={deletingId === zone.id}
                                            className="w-full sm:w-auto"
                                        >
                                            {deletingId === zone.id ? (
                                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                            )}
                                            {deletingId === zone.id ? t("common.deleting") : t("common.delete")}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.li>
    );
}
