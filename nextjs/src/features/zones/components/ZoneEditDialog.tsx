"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Zone } from "../types";
import { formatZoneOptionLabel } from "../lib/tree";
import { DEFAULT_FIRST_LEVEL_COLOR, normalizeHexColor } from "@zones/lib/colors";

type ZoneEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: Zone;
  zones: Zone[];
  zonesById: Map<string, Zone>;
  zoneDepths: Map<string, number>;
  t: (key: string, args?: Record<string, string | number>) => string;
  onSave: (id: string, payload: { name: string; parent_id: string | null; note: string | null; surface: number | null; color?: string | null }) => Promise<void>;
};

export default function ZoneEditDialog({ open, onOpenChange, zone, zones, zonesById, zoneDepths, t, onSave }: ZoneEditDialogProps) {
  const [name, setName] = useState(zone.name);
  const [parentId, setParentId] = useState<string | "">(zone.parent_id ?? "");
  const [surface, setSurface] = useState(
    typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? String(zone.surface) : ""
  );
  const [note, setNote] = useState(zone.note ?? "");
  const [colorValue, setColorValue] = useState(zone.color || DEFAULT_FIRST_LEVEL_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftParent = useMemo(() => (parentId ? zonesById.get(parentId) ?? null : null), [parentId, zonesById]);
  const isDraftFirstLevel = !!(draftParent && !draftParent.parent_id);

  useEffect(() => {
    if (!open) return;
    setName(zone.name);
    setParentId(zone.parent_id ?? "");
    setSurface(typeof zone.surface === "number" && !Number.isNaN(zone.surface) ? String(zone.surface) : "");
    setNote(zone.note ?? "");
    setColorValue(zone.color || DEFAULT_FIRST_LEVEL_COLOR);
    setError(null);
  }, [open, zone]);

  const handleSave = async () => {
    setError(null);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError(t("common.subject"));
      return;
    }
    const sTrim = surface.trim();
    let sVal: number | null = null;
    if (sTrim) {
      const parsed = Number(sTrim);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError(t("zones.invalidSurface"));
        return;
      }
      sVal = parsed;
    }
    const noteVal = note.trim() || null;
    const colorPayload = isDraftFirstLevel ? normalizeHexColor(colorValue) : null;
    if (isDraftFirstLevel && !colorPayload) {
      setError(t("zones.colorRequired"));
      return;
    }
    setSaving(true);
    try {
      await onSave(zone.id, {
        name: nameTrim,
        parent_id: parentId || null,
        note: noteVal,
        surface: sVal,
        color: colorPayload ?? undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("zones.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("zones.edit")}</DialogTitle>
          <DialogDescription>{t("zones.detail.editDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("zones.placeholder")} />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">{t("zones.noParent")}</option>
            {zones
              .filter((candidate) => candidate.id !== zone.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {formatZoneOptionLabel(candidate, zoneDepths)}
                </option>
              ))}
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            placeholder={t("zones.surfacePlaceholder")}
          />
          {isDraftFirstLevel ? (
            <div className="flex flex-col gap-1 rounded-md border border-indigo-100 bg-white/70 p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{t("zones.colorLabel")}</label>
              <input
                type="color"
                value={colorValue}
                onChange={(e) => setColorValue(e.target.value)}
                className="h-10 w-full rounded-md border border-indigo-200 bg-white p-1"
                aria-label={t("zones.colorLabel")}
              />
              <p className="text-xs text-slate-500">{t("zones.colorHelper")}</p>
            </div>
          ) : null}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("zones.notePlaceholder")} rows={4} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </span>
              ) : (
                t("common.save")
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

