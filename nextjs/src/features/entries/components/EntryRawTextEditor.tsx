// nextjs/src/features/entries/components/EntryRawTextEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { Pencil, X, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useUpdateEntryRawText } from "@/features/entries/hooks/useUpdateEntryRawText";

type Props = {
  entryId: string;
  initialText: string;
  onSaved?: () => void;
};

export default function EntryRawTextEditor({ entryId, initialText, onSaved }: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialText || "");
  const { updateRawText, loading } = useUpdateEntryRawText();

  useEffect(() => {
    // If entry reloads, keep editor in sync when not editing
    if (!editing) setValue(initialText || "");
  }, [initialText, editing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return; // keep same UX as creation requiring some text
    try {
      await updateRawText(entryId, trimmed);
      setEditing(false);
      onSaved?.();
    } catch {
      alert(t("entries.updateFailed"));
    }
  };

  const handleCancel = () => {
    setValue(initialText || "");
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group relative">
        <div className="flex items-start justify-between gap-2">
          <pre className="whitespace-pre-wrap text-gray-900 flex-1">{initialText}</pre>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("entries.editRaw")}
            title={t("entries.editRaw")}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder={t("entries.rawPlaceholder")}
      />
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={handleCancel} disabled={loading}>
          <X className="h-4 w-4" /> {t("common.cancel")}
        </Button>
        <Button type="button" onClick={handleSave} disabled={loading || !value.trim()}>
          <Check className="h-4 w-4" /> {loading ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
