"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Zone } from "../types";
import { formatZoneOptionLabel } from "../lib/tree";

interface Props {
    open: boolean;
    setOpen: (v: boolean) => void;
    t: (key: string, args?: Record<string, string | number>) => string;
    sortedZones: Zone[];
    zoneDepths: Map<string, number>;
    onCreate: (payload: { name: string; parent_id: string | null; note: string | null; surface: number | null }) => Promise<void>;
}

export default function ZoneForm({ open, setOpen, t, sortedZones, zoneDepths, onCreate }: Props) {
    const [name, setName] = useState("");
    const [parentId, setParentId] = useState<string | "">("");
    const [surface, setSurface] = useState("");
    const [note, setNote] = useState("");
    const [creating, setCreating] = useState(false);

    const reset = () => {
        setName("");
        setParentId("");
        setSurface("");
        setNote("");
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
        setCreating(true);
        try {
            await onCreate({ name: nameTrim, parent_id: parentId || null, note: noteVal, surface: sVal });
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
