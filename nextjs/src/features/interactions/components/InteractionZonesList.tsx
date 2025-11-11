// nextjs/src/features/interactions/components/InteractionZonesList.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Layers } from "lucide-react";
import { useInteractionZones } from "@interactions/hooks/useInteractionZones";
import { useZones } from "@/features/zones/hooks/useZones";

import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
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

  const initialSelection = useMemo(() => interactionZones.map((z) => z.id), [interactionZones]);
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [saving, setSaving] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);

  useEffect(() => {
    if (activeTrigger === null) {
      setSelected(initialSelection);
    }
  }, [initialSelection, activeTrigger]);

  const handleOverlayChange = useCallback(
    (triggerId: string, next: boolean) => {
      if (next) {
        setSelected(initialSelection);
        setActiveTrigger(triggerId);
        return;
      }
      setActiveTrigger((current) => (current === triggerId ? null : current));
    },
    [initialSelection],
  );

  const handleSave = async (close: () => void) => {
    if (selected.length === 0) {
      alert(t("interactionsselectZoneRequired"));
      return;
    }
    setSaving(true);
    try {
      await updateZones(selected);
      close();
    } catch (e) {
      console.error(e);
      alert(t("zones.loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {interactionZones.length > 0 ? (
        <ul role="list" className="flex flex-wrap gap-2">
          {interactionZones.map((z) => (
            <li key={z.id}>
              <ZoneOverlayTrigger
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs transition hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    title={t("zones.edit")}
                  >
                    <Layers className="h-3 w-3" />
                    {z.name}
                  </button>
                }
                title={t("interactionszones")}
                open={activeTrigger === z.id}
                onOpenChange={(next) => handleOverlayChange(z.id, next)}
              >
                {({ close }) => (
                  <ZoneSelectionContent
                    loadingZones={loadingZones}
                    zones={hhZones}
                    selected={selected}
                    onSelectionChange={setSelected}
                    saving={saving}
                    onSave={() => handleSave(close)}
                    onCancel={close}
                  />
                )}
              </ZoneOverlayTrigger>
            </li>
          ))}
        </ul>
      ) : (
        <ZoneOverlayTrigger
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-indigo-200/80 px-3 py-1 text-xs text-muted-foreground transition hover:border-indigo-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{t("interactionsnoZones")}</span>
            </button>
          }
          title={t("interactionszones")}
          open={activeTrigger === "zones-empty"}
          onOpenChange={(next) => handleOverlayChange("zones-empty", next)}
        >
          {({ close }) => (
            <ZoneSelectionContent
              loadingZones={loadingZones}
              zones={hhZones}
              selected={selected}
              onSelectionChange={setSelected}
              saving={saving}
              onSave={() => handleSave(close)}
              onCancel={close}
            />
          )}
        </ZoneOverlayTrigger>
      )}
    </div>
  );
}

type ZoneOverlayTriggerProps = {
  trigger: ReactElement;
  title: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: (helpers: {
    close: () => void;
    open: () => void;
    isOpen: boolean;
    isMobile: boolean;
  }) => ReactNode;
};
type ZoneSelectionContentProps = {
  loadingZones: boolean;
  zones: Zone[];
  selected: string[];
  onSelectionChange: (value: string[]) => void;
  saving: boolean;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
};

function ZoneSelectionContent({
  loadingZones,
  zones,
  selected,
  onSelectionChange,
  saving,
  onSave,
  onCancel,
}: ZoneSelectionContentProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      {loadingZones ? (
        <div className="text-sm text-gray-500">{t("zones.loading")}</div>
      ) : (
        <ZonePicker zones={zones} value={selected} onChange={onSelectionChange} />
      )}
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button onClick={onSave} disabled={saving || loadingZones || selected.length === 0}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function ZoneOverlayTrigger({
  trigger,
  title,
  open,
  onOpenChange,
  children,
}: ZoneOverlayTriggerProps) {
  return (
    <SheetDialog
      trigger={trigger}
      title={title}
      closeLabel={null}
      contentClassName="gap-4"
      containerClassName="pb-0"
      open={open}
      onOpenChange={onOpenChange}
    >
      {children}
    </SheetDialog>
  );
}
