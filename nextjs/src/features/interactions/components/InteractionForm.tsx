"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import AddDocumentsModal, { type StagedDocument } from "@documents/components/AddDocumentModal";
import ExistingDocumentsModal from "@interactions/components/ExistingDocumentsModal";
import SelectedFileItem from "@interactions/components/SelectedFileItem";
import { ZonePicker } from "@interactions/components/ZonePicker";
import type { Document, DocumentType, InteractionStatus, InteractionTag, InteractionType, ZoneOption } from "@interactions/types";

type LocalFile = {
  file: File;
  customName: string;
  type: DocumentType;
  notes?: string;
};

type InteractionFormProps = {
  householdId: string;
  zones: ZoneOption[];
  zonesLoading?: boolean;
  onCreated?: (interactionId: string) => void;
};

const interactionTypes: InteractionType[] = [
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

const interactionStatuses: (InteractionStatus | null)[] = [null, "pending", "in_progress", "done", "archived"];

const toLocalDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const inferFileType = (file: File): DocumentType => {
  if (file.type?.startsWith("image/")) return "photo";
  return "document";
};

const sanitizeFilename = (value: string) => value.replace(/[^0-9a-zA-Z._-]/g, "_");

export default function InteractionForm({ householdId, zones, zonesLoading = false, onCreated }: InteractionFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const { t } = useI18n();

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<InteractionType>("note");
  const [status, setStatus] = useState<InteractionStatus | "">("");
  const [occurredAt, setOccurredAt] = useState<string>(toLocalDateTime);
  const [availableTags, setAvailableTags] = useState<InteractionTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState("");
  const [tagsLoading, setTagsLoading] = useState(true);
  const [creatingTag, setCreatingTag] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasZones = zones.length > 0;

  const sortTags = useCallback(
    (list: InteractionTag[]) =>
      [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    []
  );

  useEffect(() => {
    let active = true;
    const loadTags = async () => {
      setTagsLoading(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error } = await client
          .from("tags")
          .select("id, name, household_id, type, created_at, created_by")
          .eq("household_id", householdId)
          .eq("type", "interaction")
          .order("name", { ascending: true });
        if (error) throw error;
        if (!active) return;
        const rows = (data ?? []) as InteractionTag[];
        setAvailableTags(sortTags(rows));
      } catch (loadError) {
        console.error(loadError);
        if (!active) return;
        setAvailableTags([]);
      } finally {
        if (active) setTagsLoading(false);
      }
    };

    loadTags();
    return () => {
      active = false;
    };
  }, [householdId, sortTags]);

  const selectedTags = useMemo(
    () =>
      selectedTagIds
        .map((id) => availableTags.find((tag) => tag.id === id) || null)
        .filter((tag): tag is InteractionTag => Boolean(tag)),
    [availableTags, selectedTagIds]
  );

  useEffect(() => {
    setSelectedTagIds((prev) => {
      const filtered = prev.filter((id) => availableTags.some((tag) => tag.id === id));
      if (filtered.length === prev.length && filtered.every((id, index) => id === prev[index])) {
        return prev;
      }
      return filtered;
    });
  }, [availableTags]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }, []);

  const handleRemoveTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  }, []);

  const handleCreateTag = useCallback(async () => {
    const trimmed = tagInputValue.trim();
    if (!trimmed) return;
    const existing = availableTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setSelectedTagIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
      setTagInputValue("");
      show({ title: t("interactionstagsDuplicate"), variant: "info" });
      return;
    }

    setCreatingTag(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error } = await client
        .from("tags")
        .insert({
          household_id: householdId,
          type: "interaction",
          name: trimmed,
        })
        .select("id, name, household_id, type, created_at, created_by")
        .single();
      if (error) {
        if ((error as any)?.code === "23505") {
          const dup = availableTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
          if (dup) {
            setSelectedTagIds((prev) => (prev.includes(dup.id) ? prev : [...prev, dup.id]));
            setTagInputValue("");
            show({ title: t("interactionstagsDuplicate"), variant: "info" });
            return;
          }
        }
        throw error;
      }

      const newTag = (data as unknown as InteractionTag) ?? null;
      if (newTag) {
        setAvailableTags((prev) => sortTags([...prev, newTag]));
        setSelectedTagIds((prev) => [...prev, newTag.id]);
      }
      setTagInputValue("");
    } catch (createError: any) {
      console.error(createError);
      const description = createError?.message || t("interactionstagsCreateFailed");
      show({ title: t("interactionstagsCreateFailed"), description, variant: "error" });
    } finally {
      setCreatingTag(false);
    }
  }, [availableTags, householdId, sortTags, show, t, tagInputValue]);

  const handleTagInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (!creatingTag) {
          handleCreateTag();
        }
      }
    },
    [creatingTag, handleCreateTag]
  );

  const zoneHelper = useMemo(() => {
    if (zonesLoading) return t("zones.loading");
    if (!hasZones) return t("zones.none");
    return t("interactionszoneHelper");
  }, [hasZones, t, zonesLoading]);

  const handleFilesSelected = useCallback((picked: File[]) => {
    if (!picked.length) return;
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({
        file,
        customName: file.name,
        type: inferFileType(file),
        notes: "",
      })),
    ]);
  }, []);

  const handleDocumentsStaged = useCallback((staged: StagedDocument[]) => {
    if (staged.length === 0) return;

    setFiles((prev) => [
      ...prev,
      ...staged.map<LocalFile>((item) => ({
        file: item.file,
        customName: item.name || item.file.name,
        type: item.type,
        notes: item.notes,
      })),
    ]);
  }, []);

  const handleFileNameChange = useCallback((index: number, value: string) => {
    setFiles((prev) => prev.map((item, idx) => (idx === index ? { ...item, customName: value } : item)));
  }, []);

  const handleFileTypeChange = useCallback((index: number, nextType: DocumentType) => {
    setFiles((prev) => prev.map((item, idx) => (idx === index ? { ...item, type: nextType } : item)));
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleLibraryConfirm = useCallback(async (docs: Document[]) => {
    if (!docs.length) return;
    setLibraryDocuments((prev) => {
      const map = new Map(prev.map((doc) => [doc.id, doc]));
      docs.forEach((doc) => map.set(doc.id, doc));
      return Array.from(map.values());
    });
  }, []);

  const handleRemoveLibraryDocument = useCallback((id: string) => {
    setLibraryDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const resetForm = () => {
    setSubject("");
    setContent("");
    setType("note");
    setStatus("");
    setOccurredAt(toLocalDateTime());
    setSelectedTagIds([]);
    setTagInputValue("");
    setSelectedZones([]);
    setFiles([]);
    setDocumentsModalOpen(false);
    setLibraryModalOpen(false);
    setLibraryDocuments([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedContent = content.trim();
    const trimmedSubject = subject.trim() || trimmedContent.slice(0, 80);

    if (!trimmedSubject) {
      setError(t("interactionssubjectRequired"));
      return;
    }

    if (!trimmedContent) {
      setError(t("interactionsrawRequired"));
      return;
    }

    if (!selectedZones.length) {
      setError(t("interactionsselectZoneRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error(t("auth.notAuthenticated"));

      const occurredAtValue = occurredAt ? new Date(occurredAt).toISOString() : null;

      const { data: createdId, error: createError } = await client.rpc("create_interaction_with_zones", {
        p_household_id: householdId,
        p_subject: trimmedSubject,
        p_zone_ids: selectedZones,
        p_content: trimmedContent,
        p_type: type,
        p_status: status || null,
        p_occurred_at: occurredAtValue,
        p_tag_ids: selectedTagIds.length ? selectedTagIds : null,
      });

      if (createError || !createdId) {
        throw createError ?? new Error(t("interactionscreateFailed"));
      }

      const interactionId = createdId as string;

      if (files.length > 0) {
        for (const item of files) {
          const safeBaseName = sanitizeFilename(item.customName || item.file.name || "document");
          const uniquePrefix =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = `${userId}/${interactionId}/${uniquePrefix}_${safeBaseName}`;

          const { error: uploadError } = await client.storage
            .from("files")
            .upload(storagePath, item.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: item.file.type || undefined,
            });
          if (uploadError) throw uploadError;

          const { data: insertedDoc, error: docError } = await client
            .from("documents")
            .insert({
              household_id: householdId,
              file_path: storagePath,
              mime_type: item.file.type || null,
              type: item.type,
              name: item.customName || item.file.name,
              notes: item.notes ?? "",
              metadata: {
                size: item.file.size,
                originalName: item.file.name,
              },
            })
            .select("id")
            .single();
          if (docError) throw docError;
          const documentId = insertedDoc?.id as string | undefined;
          if (!documentId) throw new Error("Failed to create document");

          const { error: linkError } = await client.from("interaction_documents").insert({
            interaction_id: interactionId,
            document_id: documentId,
            role: "attachment",
            note: item.notes ?? "",
          });
          if (linkError) throw linkError;
        }
      }

      if (libraryDocuments.length > 0) {
        const existingPayload = libraryDocuments.map((doc) => ({
          interaction_id: interactionId,
          document_id: doc.id,
          role: doc.link_role ?? "attachment",
          note: doc.link_note ?? "",
        }));
        const { error: linkExistingError } = await client
          .from("interaction_documents")
          .upsert(existingPayload, { onConflict: "interaction_id,document_id" });
        if (linkExistingError) throw linkExistingError;
      }

      resetForm();
      onCreated?.(interactionId);
      router.push("/app/interactions?created=1");
    } catch (e: any) {
      console.error(e);
      const message = e?.message || t("interactionscreateFailed");
      setError(message);
      show({ title: t("interactionscreateFailed"), description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">{t("interactionssections.details")}</h2>
            <p className="text-sm text-gray-600">{t("interactionssubjectHelper")}</p>
          </header>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-subject">
              {t("common.subject")}
            </label>
            <Input
              id="interaction-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("interactionssubjectPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-type">
              {t("interactionstypeLabel")}
            </label>
            <select
              id="interaction-type"
              value={type}
              onChange={(event) => setType(event.target.value as InteractionType)}
              className="border rounded-md h-9 w-full px-3 text-sm bg-background"
            >
              {interactionTypes.map((value) => (
                <option key={value} value={value}>
                  {t(`interactionstypes.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-status">
              {t("interactionsstatusLabel")}
            </label>
            <select
              id="interaction-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as InteractionStatus | "")}
              className="border rounded-md h-9 w-full px-3 text-sm bg-background"
            >
              {interactionStatuses.map((value) => (
                <option key={value ?? "none"} value={value ?? ""}>
                  {value ? t(`interactionsstatus.${value}`) : t("interactionsstatusNone")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-occurred-at">
              {t("interactionsoccurredAtLabel")}
            </label>
            <Input
              id="interaction-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-tags">
              {t("interactionstagsLabel")}
            </label>
            <p className="text-xs text-gray-500">{t("interactionstagsHelper")}</p>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                  >
                    #{tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="rounded-full p-0.5 leading-none text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800"
                      aria-label={t("interactionstagsRemove", { name: tag.name })}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="interaction-tags"
                value={tagInputValue}
                onChange={(event) => setTagInputValue(event.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder={t("interactionstagsCreatePlaceholder")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateTag}
                disabled={creatingTag || !tagInputValue.trim()}
              >
                {creatingTag ? t("common.saving") : t("interactionstagsAdd")}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t("interactionstagsExisting")}
              </p>
              {tagsLoading ? (
                <div className="text-xs text-gray-500">{t("interactionstagsLoading")}</div>
              ) : availableTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-indigo-200 bg-indigo-100 text-indigo-700"
                            : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        aria-pressed={selected}
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-gray-500">{t("interactionstagsNone")}</div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">{t("interactionssections.meta")}</h2>
            <p className="text-sm text-gray-600">{zoneHelper}</p>
          </header>

          <div className="rounded-lg border border-gray-200 bg-white/60 p-3">
            {zonesLoading ? (
              <div className="text-sm text-gray-500">{t("common.loading")}</div>
            ) : hasZones ? (
              <ZonePicker zones={zones} value={selectedZones} onChange={setSelectedZones} />
            ) : (
              <div className="text-sm text-gray-500">{t("zones.none")}</div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">{t("interactionssections.description")}</h2>
            <p className="text-sm text-gray-600">{t("interactionsrawHelper")}</p>
          </header>

          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            placeholder={t("interactionsrawPlaceholder")}
          />
        </section>

        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">{t("interactionssections.files")}</h2>
            <p className="text-sm text-gray-600">{t("interactionsdocumentsHelper")}</p>
          </header>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setDocumentsModalOpen(true)}>
              {t("interactionsopenDocumentsModal")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setLibraryModalOpen(true)}>
              {t("interactions.linkExistingDocuments")}
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t("interactionsselectedFiles", { count: files.length })}
              </p>
              <ul className="space-y-2">
                {files.map((item, index) => (
                  <SelectedFileItem
                    key={`${item.file.name}-${index}`}
                    index={index}
                    file={item.file}
                    type={item.type}
                    customName={item.customName}
                    fileTypeLabel={t("interactionsfileTypeLabel")}
                    onCustomNameChange={handleFileNameChange}
                    onFileTypeChange={handleFileTypeChange}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </ul>
            </div>
          )}

          {libraryDocuments.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t("interactions.selectedLibraryDocuments", { count: libraryDocuments.length })}
              </p>
              <ul className="space-y-2">
                {libraryDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        {t(`interactionstypes.${doc.type}`, { defaultValue: doc.type })}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveLibraryDocument(doc.id)}>
                      {t("common.remove")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting || zonesLoading || !hasZones}>
            {submitting ? t("common.saving") : t("interactionscreateCta")}
          </Button>
        </div>
      </form>

      <AddDocumentsModal
        open={documentsModalOpen}
        onOpenChange={setDocumentsModalOpen}
        householdId={householdId}
        mode="staging"
        multiple
        onStagedChange={handleDocumentsStaged}
      />
      <ExistingDocumentsModal
        open={libraryModalOpen}
        onOpenChange={setLibraryModalOpen}
        householdId={householdId}
        onConfirm={handleLibraryConfirm}
      />
    </>
  );
}
