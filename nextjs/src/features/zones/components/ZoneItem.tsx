"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Layers, Ruler, StickyNote, Pencil, Trash2, Loader2 } from "lucide-react";
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
}

export default function ZoneItem({ zone, zonesById, sortedZones, zoneDepths, numberFormatter, t, onEdit, onAskDelete, deletingId }: Props) {
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
        <li
            className={clsx(
                "group rounded-md border px-3 py-3 shadow-sm transition hover:border-gray-300",
                depth > 0 ? "bg-slate-50 border-l-4 border-l-indigo-200" : "border-l-4 border-l-slate-200 bg-white"
            )}
            style={depth ? { marginLeft: depth * 12 } : undefined}
        >
            {isEditing ? (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 md:flex-row">
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="md:flex-1" />
                        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 rounded-md border px-3 text-sm md:w-56">
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
                    <div className="flex flex-col gap-2 md:flex-row">
                        <Input type="number" min="0" step="0.01" value={surface} onChange={(e) => setSurface(e.target.value)} placeholder={t("zones.surfacePlaceholder")} className="md:w-48" />
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
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <Layers className="h-4 w-4 text-gray-400" />
                            <span>{zone.name}</span>
                        </div>
                        {(parent || surfaceText) && (
                            <div className="flex flex-wrap gap-2 text-xs">
                                {parent ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                        <Layers className="h-3 w-3" />
                                        {t("zones.childOf", { parent: parent.name })}
                                    </span>
                                ) : null}
                                {surfaceText ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                        <Ruler className="h-3 w-3" />
                                        {t("zones.surfaceValue", { value: surfaceText })}
                                    </span>
                                ) : null}
                            </div>
                        )}
                        {zone.note ? (
                            <div className="flex items-start gap-2 text-xs text-gray-600">
                                <StickyNote className="mt-0.5 h-4 w-4 text-gray-400" />
                                <span>{t("zones.noteValue", { note: zone.note })}</span>
                            </div>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="icon" variant="secondary" onClick={() => setIsEditing(true)} aria-label={t("zones.edit")}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => onAskDelete(zone)}
                            disabled={deletingId === zone.id}
                            aria-label={deletingId === zone.id ? t("common.deleting") : t("common.delete")}
                        >
                            {deletingId === zone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            )}
        </li>
    );
}