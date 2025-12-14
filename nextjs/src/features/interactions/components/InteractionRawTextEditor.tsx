// nextjs/src/features/interactions/components/InteractionRawTextEditor.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { TinyEditor } from "@/components/rich-text/TinyEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useUpdateInteractionContent } from "@interactions/hooks/useUpdateInteractionContent";

type Props = {
  interactionId: string;
  initialContent: string;
  onSaved?: () => void;
};

export default function InteractionRawTextEditor({ interactionId, initialContent, onSaved }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialContent || "");
  const [lastSavedValue, setLastSavedValue] = useState(initialContent || "");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { updateContent, loading } = useUpdateInteractionContent();

  useEffect(() => {
    const nextValue = initialContent || "";
    setValue(nextValue);
    setLastSavedValue(nextValue);
  }, [initialContent]);

  const plainText = useMemo(
    () => value.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim(),
    [value]
  );
  const displayHtml = useMemo(
    () =>
      value && value.trim().length > 0
        ? value
        : `<p class="text-muted-foreground">${t("interactionsrawPlaceholder")}</p>`,
    [t, value]
  );
  const trimmedValue = value.trim();
  const isDirty = trimmedValue !== (lastSavedValue || "").trim();

  const handleSave = useCallback(async () => {
    if (!plainText || !isDirty) return;
    const trimmed = trimmedValue;
    try {
      await updateContent(interactionId, trimmed);
      setLastSavedValue(trimmed);
      onSaved?.();
    } catch {
      alert(t("interactionsupdateFailed"));
    }
  }, [interactionId, isDirty, onSaved, plainText, trimmedValue, t, updateContent]);

  // Autosave with a small debounce window when content changes
  useEffect(() => {
    if (!plainText || !isDirty || loading) return;
    const timeout = setTimeout(() => {
      void handleSave();
    }, 900);
    return () => clearTimeout(timeout);
  }, [handleSave, isDirty, loading, plainText]);

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDirty && !loading) {
        void handleSave();
      }
      setIsEditorOpen(open);
    },
    [handleSave, isDirty, loading]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <SheetDialog
          trigger={
            <Button size="sm" variant="outline" disabled={loading}>
              {loading ? t("common.saving") : t("common.edit")}
            </Button>
          }
          closeLabel={t("common.close")}
          contentClassName="gap-4"
          open={isEditorOpen}
          onOpenChange={handleSheetOpenChange}
        >
          <TinyEditor
            id="interaction-description"
            value={value}
            onChange={setValue}
            textareaName="interaction-description"
            height={600}
          />
        </SheetDialog>
      </div>
      <div
        className="mt-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_blockquote]:border-l-4 [&_blockquote]:border-l-muted [&_blockquote]:pl-3 [&_h1]:text-xl [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:mt-4 [&_h3]:mb-2.5 [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-1.5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </div>
  );
}
