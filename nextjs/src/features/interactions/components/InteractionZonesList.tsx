// nextjs/src/features/interactions/components/InteractionZonesList.tsx
// nextjs/src/features/entries/components/InteractionZonesList.tsx
"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { useInteractionZones } from "@interactions/hooks/useInteractionZones";
import { useZones } from "@/features/zones/hooks/useZones";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Zone } from "@/features/zones/types";
import { ZonePicker } from "./ZonePicker";

type Props = {
  interactionId: string;
};

export default function InteractionZonesList({ interactionId }: Props) {
  const { t } = useI18n();
  const { zones: interactionZones, updateZones } = useInteractionZones(interactionId);
  const { zones: hhZones, loading: loadingZones } = useZones();

  const [open, setOpen] = useState(false);
  const initialSelection = useMemo(() => interactionZones.map((z) => z.id), [interactionZones]);
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [saving, setSaving] = useState(false);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelected(initialSelection);
    }
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      alert(t("interactionsselectZoneRequired"));
      return;
    }
    setSaving(true);
    try {
      await updateZones(selected);
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert(t("zones.loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {interactionZones.length > 0 ? (
        <ul role="list" className="flex flex-wrap gap-2">
          {interactionZones.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                onClick={() => handleOpen(true)}
                title={t("zones.edit")}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs hover:bg-indigo-100 hover:border-indigo-300"
              >
                <Layers className="h-3 w-3" />
                {z.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-500">{t("interactionsnoZones")}</div>
      )}

      <ZoneSelectionDialog
        open={open}
        onOpenChange={handleOpen}
        loadingZones={loadingZones}
        zones={hhZones}
        selected={selected}
        onSelectionChange={setSelected}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}

type ZoneSelectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadingZones: boolean;
  zones: Zone[];
  selected: string[];
  onSelectionChange: (value: string[]) => void;
  saving: boolean;
  onSave: () => void | Promise<void>;
};

function ZoneSelectionDialog({
  open,
  onOpenChange,
  loadingZones,
  zones,
  selected,
  onSelectionChange,
  saving,
  onSave,
}: ZoneSelectionDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("interactionszones")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loadingZones ? (
            <div className="text-sm text-gray-500">{t("zones.loading")}</div>
          ) : (
            <ZonePicker zones={zones} value={selected} onChange={onSelectionChange} />
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} disabled={saving || loadingZones || selected.length === 0}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
