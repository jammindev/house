// nextjs/src/features/interactions/components/EntryForm.tsx
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useZones } from "@/features/zones/hooks/useZones";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";

import DocumentImportButtons from "@interactions/components/DocumentImportButtons";
import type { DocumentType, InteractionStatus, InteractionType } from "@interactions/types";
import SelectedFileItem from "./SelectedFileItem";
import { ZonePicker } from "./ZonePicker";

const INTERACTION_TYPES: InteractionType[] = [
  "note",
  "todo",
  "call",
  "meeting",
  "document",
  "expense",
  "message",
  "signature",
  "other",
];

const STATUS_OPTIONS: InteractionStatus[] = ["pending", "in_progress", "done", "archived"];

type SelectedFile = { file: File; type: DocumentType; customName: string };

const nowLocal = () => {
  const date = new Date();
  date.setMilliseconds(0);
  return date.toISOString().slice(0, 16);
};

export default function EntryForm() {
  const router = useRouter();
  const { selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { zones, loading: loadingZones } = useZones(selectedHouseholdId);

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [interactionType, setInteractionType] = useState<InteractionType>("note");
  const [status, setStatus] = useState<InteractionStatus | "">("");
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [tagsInput, setTagsInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  const fileTypeLabel = useMemo(() => t("entries.fileTypeLabel"), [t]);

  const inferType = (file: File): DocumentType =>
    file.type && file.type.startsWith("image/") ? "photo" : "document";

  const makeKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

  const handleFilesSelected = (files: File[]) => {
    if (!files.length) return;
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((item) => makeKey(item.file)));
      const next = [...prev];
      files.forEach((file) => {
        const key = makeKey(file);
        if (!existing.has(key)) {
          existing.add(key);
          next.push({ file, type: inferType(file), customName: "" });
        }
      });
      return next;
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFileTypeChange = (index: number, type: DocumentType) => {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (!target || !(target.file.type && target.file.type.startsWith("image/"))) {
        return prev;
      }
      return prev.map((item, idx) => (idx === index ? { ...item, type } : item));
    });
  };

  const handleCustomNameChange = (index: number, value: string) => {
    setSelectedFiles((prev) => prev.map((item, idx) => (idx === index ? { ...item, customName: value } : item)));
  };

  const resolveFinalFileName = (item: SelectedFile) => {
    const originalName = item.file.name;
    const trimmed = item.customName?.trim() ?? "";
    const extension = originalName.includes(".") ? originalName.substring(originalName.lastIndexOf(".")) : "";
    if (!trimmed) {
      return extension ? `file${extension}` : "file";
    }
    if (trimmed.includes(".")) {
      return trimmed;
    }
    return `${trimmed}${extension}`;
  };

  const parseTags = (value: string): string[] =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const toIso = (value: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const handleSubmit = async () => {
    if (!selectedHouseholdId) {
      alert(t("common.selectHouseholdFirst"));
      return;
    }
    if (!subject.trim()) {
      alert(t("entries.subjectRequired"));
      return;
    }
    if (!content.trim()) {
      alert(t("entries.rawRequired"));
      return;
    }
    if (!selectedZoneIds.length) {
      alert(t("entries.selectZoneRequired"));
      return;
    }

    setLoading(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error(t("auth.notAuthenticated"));

      const tags = parseTags(tagsInput);

      const { data: rpcData, error } = await client.rpc("create_interaction_with_zones" as any, {
        p_household_id: selectedHouseholdId,
        p_subject: subject.trim(),
        p_content: content.trim(),
        p_type: interactionType,
        p_status: status || null,
        p_occurred_at: toIso(occurredAt),
        p_zone_ids: selectedZoneIds,
        p_tags: tags.length ? tags : null,
        p_contact_id: null,
        p_structure_id: null,
      });
      if (error) throw error;
      const interactionId = rpcData as string | null;
      if (!interactionId) throw new Error(t("entries.createFailed"));

      const uploadedPaths: string[] = [];

      try {
        if (selectedFiles.length) {
          for (const item of selectedFiles) {
            const { file, type } = item;
            const finalName = resolveFinalFileName(item);
            const safeName = finalName.replace(/[^0-9a-zA-Z._-]/g, "_");
            const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            const storagePath = `${userId}/${interactionId}/${uniqueId}_${safeName}`;

            const { error: uploadError } = await client.storage
              .from("files")
              .upload(storagePath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || undefined,
              });
            if (uploadError) throw uploadError;
            uploadedPaths.push(storagePath);

            const resolvedType: DocumentType = file.type && file.type.startsWith("image/") ? type : "document";
            const { error: linkError } = await client
              .from("documents" as any)
              .insert({
                interaction_id: interactionId,
                file_path: storagePath,
                mime_type: file.type || null,
                type: resolvedType,
                name: finalName,
                notes: "",
                metadata: {
                  size: file.size,
                  customName: finalName,
                },
              });
            if (linkError) throw linkError;
          }
        }
      } catch (attachmentError) {
        try {
          if (uploadedPaths.length) {
            await client.storage.from("files").remove(uploadedPaths);
          }
        } catch (cleanupError) {
          console.warn("Failed to cleanup uploaded files", cleanupError);
        }
        try {
          await client.from("interactions" as any).delete().eq("id", interactionId);
        } catch (cleanupInteractionError) {
          console.warn("Failed to cleanup interaction after attachment error", cleanupInteractionError);
        }
        throw attachmentError;
      }

      router.push("/app/interactions?created=1");
    } catch (e: any) {
      console.error(e);
      alert(t("entries.createFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">{t("entries.sections.details")}</h3>
        <p className="text-xs text-gray-600">{t("entries.subjectHelper")}</p>
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t("entries.subjectPlaceholder")}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">{t("entries.sections.meta")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600" htmlFor="interaction-type">
              {t("entries.typeLabel")}
            </label>
            <select
              id="interaction-type"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={interactionType}
              onChange={(event) => setInteractionType(event.target.value as InteractionType)}
            >
              {INTERACTION_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`entries.types.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600" htmlFor="interaction-status">
              {t("entries.statusLabel")}
            </label>
            <select
              id="interaction-status"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as InteractionStatus | "")}
            >
              <option value="">{t("entries.statusNone")}</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`entries.status.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600" htmlFor="interaction-occurred-at">
              {t("entries.occurredAtLabel")}
            </label>
            <Input
              id="interaction-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600" htmlFor="interaction-tags">
              {t("entries.tagsLabel")}
            </label>
            <Input
              id="interaction-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder={t("entries.tagsPlaceholder")}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">{t("entries.sections.description")}</h3>
        <p className="text-xs text-gray-600">{t("entries.rawHelper")}</p>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("entries.rawPlaceholder")}
          rows={6}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">{t("entries.sections.zones")}</h3>
        <p className="text-xs text-gray-600">{t("entries.zoneHelper")}</p>
        {loadingZones ? (
          <div className="text-sm text-gray-500">{t("zones.loading")}</div>
        ) : (
          <ZonePicker zones={zones} value={selectedZoneIds} onChange={setSelectedZoneIds} />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900">{t("entries.sections.files")}</h3>
        <p className="text-xs text-gray-600">{t("entries.documentsHelper")}</p>
        <DocumentImportButtons onFilesSelected={handleFilesSelected} />

        {selectedFiles.length > 0 && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">
              {t("entries.selectedFiles", { count: selectedFiles.length })}
            </p>
            <ul className="space-y-1">
              {selectedFiles.map((item, index) => (
                <SelectedFileItem
                  key={`${item.file.name}-${item.file.lastModified}-${index}`}
                  index={index}
                  file={item.file}
                  type={item.type}
                  customName={item.customName}
                  fileTypeLabel={fileTypeLabel}
                  onCustomNameChange={handleCustomNameChange}
                  onFileTypeChange={handleFileTypeChange}
                  onRemove={handleRemoveFile}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="flex gap-2 justify-end">
        <Button
          onClick={handleSubmit}
          disabled={
            loading ||
            !subject.trim() ||
            !content.trim() ||
            selectedZoneIds.length === 0
          }
        >
          {loading ? t("common.saving") : t("common.save")}
        </Button>
        <Button variant="secondary" onClick={() => router.back()} disabled={loading}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
