"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Zone } from "../types";
import { formatZoneOptionLabel } from "../lib/tree";
import { DEFAULT_FIRST_LEVEL_COLOR, normalizeHexColor } from "@zones/lib/colors";

interface Props {
    open: boolean;
    setOpen: (v: boolean) => void;
    t: (key: string, args?: Record<string, string | number>) => string;
    sortedZones: Zone[];
    zoneDepths: Map<string, number>;
    onCreate: (payload: { name: string; parent_id: string | null; note: string | null; surface: number | null; color?: string | null }) => Promise<void>;
}

export default function ZoneForm({ open, setOpen, t, sortedZones, zoneDepths, onCreate }: Props) {
    const [name, setName] = useState("");
    const [parentId, setParentId] = useState<string | "">("");
    const [surface, setSurface] = useState("");
    const [note, setNote] = useState("");
    const [color, setColor] = useState(DEFAULT_FIRST_LEVEL_COLOR);
    const [creating, setCreating] = useState(false);

    const selectedParent = useMemo(() => (parentId ? sortedZones.find((z) => z.id === parentId) ?? null : null), [parentId, sortedZones]);
    const requiresColorSelection = !!(selectedParent && !selectedParent.parent_id);

    const reset = () => {
        setName("");
        setParentId("");
        setSurface("");
        setNote("");
        setColor(DEFAULT_FIRST_LEVEL_COLOR);
    };

    const handleCreate = async () => {
        const nameTrim = name.trim();
        if (!nameTrim) return;
        const sTrim = surface.trim();
        let sVal: number | null = null;
        if (sTrim) {
            const parsed = Number(sTrim);
            if (Number.isNaN(parsed) || parsed < 0) {
                throw new Error(t("zones.invalidSurface"));
            }
            sVal = parsed;
        }
        const noteVal = note.trim() || null;
        const colorValue = requiresColorSelection ? normalizeHexColor(color) : null;
        if (requiresColorSelection && !colorValue) {
            throw new Error(t("zones.colorRequired"));
        }
        setCreating(true);
        try {
            await onCreate({ name: nameTrim, parent_id: parentId || null, note: noteVal, surface: sVal, color: colorValue });
            setOpen(false);
            reset();
        } finally {
            setCreating(false);
        }
    };

    if (!open) return null;

    return (
        <div className="mb-4 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-col gap-2 md:flex-row">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("zones.placeholder")} className="md:flex-1" />
                <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 rounded-md border px-3 text-sm md:w-56">
                    <option value="">{t("zones.noParent")}</option>
                    {sortedZones.map((z) => (
                        <option key={z.id} value={z.id}>
                            {formatZoneOptionLabel(z, zoneDepths)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
                <Input type="number" min="0" step="0.01" value={surface} onChange={(e) => setSurface(e.target.value)} placeholder={t("zones.surfacePlaceholder")} className="md:w-48" />
            </div>
            {requiresColorSelection ? (
                <div className="flex flex-col gap-1 rounded-md border border-indigo-100 bg-white/70 p-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{t("zones.colorLabel")}</label>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-12 w-full rounded-md border border-indigo-200 bg-white p-1 md:h-10 md:w-40"
                            aria-label={t("zones.colorLabel")}
                        />
                        <p className="text-xs text-slate-500 md:flex-1">{t("zones.colorHelper")}</p>
                    </div>
                </div>
            ) : null}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("zones.notePlaceholder")} rows={3} />
            <div className="flex flex-wrap gap-2">
                <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                    {creating ? t("common.creating") : t("common.save")}
                </Button>
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={creating}>
                    {t("common.cancel")}
                </Button>
            </div>
        </div>
    );
}
