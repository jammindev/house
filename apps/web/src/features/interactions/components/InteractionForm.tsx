// nextjs/src/features/interactions/components/InteractionForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AddDocumentsModal, { type StagedDocument } from "@documents/components/AddDocumentModal";
import ExistingDocumentsModal from "@interactions/components/ExistingDocumentsModal";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";
import ContactSelector from "@interactions/components/ContactSelector";
import StructureSelector from "@interactions/components/StructureSelector";
import SelectedFileItem from "@interactions/components/SelectedFileItem";
import { ZonePicker } from "@interactions/components/ZonePicker";
import InteractionTagsSelector from "@interactions/components/InteractionTagsSelector";
import { INTERACTION_STATUSES, INTERACTION_TYPES } from "@interactions/constants";
import { getCurrentLocalDateTimeInput } from "@interactions/utils/datetime";
import type {
  Document,
  DocumentType,
  InteractionStatus,
  InteractionType,
  ZoneOption,
} from "@interactions/types";
import type { ProjectStatus } from "@projects/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { parseAmountInput } from "@interactions/utils/amount";
import { useContacts } from "@contacts/hooks/useContacts";
import { useStructures } from "@structures/hooks/useStructures";
import type { Contact } from "@contacts/types";
import type { Structure } from "@structures/types";

type LocalFile = {
  file: File;
  customName: string;
  type: DocumentType;
  notes?: string;
};

type ProjectOption = {
  id: string;
  title: string;
  status: ProjectStatus;
};

type InteractionFormDefaults = {
  type?: InteractionType;
  status?: InteractionStatus | "";
  occurredAt?: string;
  projectId?: string | null;
};

type InteractionFormProps = {
  zones: ZoneOption[];
  zonesLoading?: boolean;
  onCreated?: (interactionId: string) => void;
  defaultValues?: InteractionFormDefaults;
};

const sanitizeFilename = (value: string) => value.replace(/[^0-9a-zA-Z._-]/g, "_");
const formatStructureDisplayName = (structure?: Structure) => structure?.name?.trim() ?? "";
const formatContactDisplayName = (contact?: Contact) => {
  if (!contact) return "";
  const first = contact.first_name?.trim() ?? "";
  const last = contact.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return contact.structure?.name?.trim() ?? "";
};

const AUTO_SUBJECT_TYPES = new Set<InteractionType>(["quote", "visit"]);

export default function InteractionForm({
  zones,
  zonesLoading = false,
  onCreated,
  defaultValues = {},
}: InteractionFormProps) {
  const router = useRouter();
  const { selectedHouseholdId: householdId } = useGlobal();
  const { show } = useToast();
  const { t } = useI18n();

  const initialOccurredAt = useMemo(
    () => defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
    [defaultValues.occurredAt]
  );

  const [subject, setSubject] = useState("");
  const [subjectDirty, setSubjectDirty] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState<InteractionType>(defaultValues.type ?? "note");
  const [status, setStatus] = useState<InteractionStatus | "">(defaultValues.status ?? "");
  const [occurredAt, setOccurredAt] = useState<string>(initialOccurredAt);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultValues.projectId ?? null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedStructureIds, setSelectedStructureIds] = useState<string[]>([]);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const { contacts } = useContacts();
  const { structures } = useStructures();

  useEffect(() => {
    const nextType = defaultValues.type ?? "note";
    setType(nextType);
    if (AUTO_SUBJECT_TYPES.has(nextType)) {
      setSubjectDirty(false);
    }
  }, [defaultValues.type]);

  useEffect(() => {
    setStatus(defaultValues.status ?? "");
  }, [defaultValues.status]);

  useEffect(() => {
    setOccurredAt(initialOccurredAt);
  }, [initialOccurredAt]);

  useEffect(() => {
    setSelectedProjectId(defaultValues.projectId ?? null);
  }, [defaultValues.projectId]);

  useEffect(() => {
    if (!householdId) {
      setProjectOptions([]);
      return;
    }
    let active = true;
    const loadProjects = async () => {
      setProjectLoading(true);
      setProjectError("");
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data, error: loadError } = await client
          .from("projects")
          .select("id, title, status")
          .eq("household_id", householdId)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (loadError) throw loadError;
        if (!active) return;
        setProjectOptions(
          (data ?? []).map(
            (row) =>
              ({
                id: row.id,
                title: row.title,
                status: row.status as ProjectStatus,
              }) satisfies ProjectOption
          )
        );
      } catch (err: unknown) {
        if (!active) return;
        const message = err instanceof Error ? err.message : t("common.unexpectedError");
        setProjectError(message);
        setProjectOptions([]);
      } finally {
        if (active) setProjectLoading(false);
      }
    };
    void loadProjects();
    return () => {
      active = false;
    };
  }, [householdId, t]);

  const hasZones = zones.length > 0;

  const zoneHelper = useMemo(() => {
    if (zonesLoading) return t("zones.loading");
    if (!hasZones) return t("zones.none");
    return t("interactionszoneHelper");
  }, [hasZones, t, zonesLoading]);

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
    setSubjectDirty(false);
    setContent("");
    setType(defaultValues.type ?? "note");
    setStatus(defaultValues.status ?? "");
    setOccurredAt(defaultValues.occurredAt ?? getCurrentLocalDateTimeInput());
    setSelectedProjectId(defaultValues.projectId ?? null);
    setSelectedTagIds([]);
    setSelectedZones([]);
    setSelectedContactIds([]);
    setSelectedStructureIds([]);
    setFiles([]);
    setDocumentsModalOpen(false);
    setLibraryModalOpen(false);
    setLibraryDocuments([]);
    setQuoteAmount("");
  };

  useEffect(() => {
    if (!AUTO_SUBJECT_TYPES.has(type) && subjectDirty) {
      setSubjectDirty(false);
    }
  }, [subjectDirty, type]);

  const primaryStructureName = useMemo(() => {
    if (!selectedStructureIds.length) return null;
    const match = structures.find((item) => item.id === selectedStructureIds[0]);
    const formatted = formatStructureDisplayName(match);
    return formatted || null;
  }, [selectedStructureIds, structures]);

  const primaryContactName = useMemo(() => {
    if (!selectedContactIds.length) return null;
    const match = contacts.find((item) => item.id === selectedContactIds[0]);
    const formatted = formatContactDisplayName(match);
    return formatted || null;
  }, [contacts, selectedContactIds]);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return null;
    const match = projectOptions.find((project) => project.id === selectedProjectId);
    const name = match?.title?.trim();
    return name || null;
  }, [projectOptions, selectedProjectId]);

  const autoSubject = useMemo(() => {
    if (type === "quote") {
      const entityName = primaryStructureName ?? primaryContactName;
      if (!entityName || !selectedProjectName) return null;
      return t("interactionsquoteAutoSubject", {
        project: selectedProjectName,
        entity: entityName,
      });
    }
    if (type === "visit") {
      const base = t("interactionsvisitBaseSubject");
      const entityName = primaryStructureName ?? primaryContactName;
      if (selectedProjectName && entityName) {
        return t("interactionsvisitAutoSubjectWithProject", {
          project: selectedProjectName,
          entity: entityName,
        });
      }
      if (selectedProjectName && !entityName) {
        return t("interactionsvisitAutoSubjectProjectOnly", { project: selectedProjectName });
      }
      if (entityName) {
        return t("interactionsvisitAutoSubject", { entity: entityName });
      }
      return base;
    }
    return null;
  }, [primaryContactName, primaryStructureName, selectedProjectName, t, type]);

  const isAutoSubjectType = AUTO_SUBJECT_TYPES.has(type);

  useEffect(() => {
    if (!autoSubject) return;
    if (subjectDirty) return;
    if (subject === autoSubject) return;
    setSubject(autoSubject);
  }, [autoSubject, subject, subjectDirty]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedContent = content.trim();
    const effectiveSubject = !subjectDirty && autoSubject ? autoSubject : subject;
    const trimmedSubject = effectiveSubject.trim() || trimmedContent.slice(0, 80);
    const contentPayload = trimmedContent.length > 0 ? trimmedContent : null;

    if (!trimmedSubject) {
      setError(t("interactionssubjectRequired"));
      return;
    }

    if (!selectedZones.length) {
      setError(t("interactionsselectZoneRequired"));
      return;
    }

    if (type === "visit" && selectedContactIds.length === 0) {
      setError(t("interactionsvisitContactRequired"));
      return;
    }

    if (type === "quote" && selectedStructureIds.length === 0 && selectedContactIds.length === 0) {
      setError(t("interactionsquoteAssociationRequired"));
      return;
    }

    let metadataPayload: Record<string, unknown> | null = null;
    if (type === "quote") {
      const trimmedAmount = quoteAmount.trim();
      if (!trimmedAmount) {
        setError(t("interactionsamountRequired"));
        return;
      }
      const parsedAmount = parseAmountInput(trimmedAmount);
      if (parsedAmount === null) {
        setError(t("interactionsamountInvalid"));
        return;
      }
      metadataPayload = { amount: parsedAmount };
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
        p_content: contentPayload,
        p_type: type,
        p_status: status || null,
        p_occurred_at: occurredAtValue,
        p_tag_ids: selectedTagIds.length ? selectedTagIds : null,
        p_contact_ids: selectedContactIds.length ? selectedContactIds : null,
        p_structure_ids: selectedStructureIds.length ? selectedStructureIds : null,
        p_project_id: selectedProjectId ?? null,
        p_metadata: metadataPayload,
      });

      if (createError || !createdId) {
        throw createError ?? new Error(t("interactionscreateFailed"));
      }

      const interactionId = createdId as string;

      if (files.length > 0) {
        for (const item of files) {
          const compressionResult = await compressFileForUpload(item.file);
          const fileForUpload = compressionResult.file;
          const safeBaseName = sanitizeFilename(fileForUpload.name || item.file.name || "document");
          const uniquePrefix =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = `${userId}/${interactionId}/${uniquePrefix}_${safeBaseName}`;

          const { error: uploadError } = await client.storage
            .from("files")
            .upload(storagePath, fileForUpload, {
              cacheControl: "3600",
              upsert: false,
              contentType: fileForUpload.type || undefined,
            });
          if (uploadError) throw uploadError;

          const { data: insertedDoc, error: docError } = await client
            .from("documents")
            .insert({
              household_id: householdId,
              file_path: storagePath,
              mime_type: fileForUpload.type || null,
              type: item.type,
              name: item.customName || item.file.name,
              notes: item.notes ?? "",
              metadata: {
                ...buildDocumentMetadata(item.file, compressionResult),
                uploadSource: "interaction_form",
              },
            })
            .select<{ id: string }>("id")
            .single();
          if (docError) throw docError;
          const documentId = insertedDoc?.id;
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
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("interactionscreateFailed");
      setError(message);
      show({ title: t("interactionscreateFailed"), description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">{t("interactionssections.details")}</CardTitle>
            <CardDescription>{t("interactionssubjectHelper")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="interaction-subject">
                {t("common.subject")}
              </label>
              <Input
                id="interaction-subject"
                value={subject}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSubject(nextValue);
                  setSubjectDirty(nextValue.trim().length > 0);
                }}
                placeholder={t("interactionssubjectPlaceholder")}
                aria-describedby={isAutoSubjectType ? "interaction-subject-auto" : undefined}
              />
              {isAutoSubjectType ? (
                <p id="interaction-subject-auto" className="flex items-center gap-2 text-xs text-gray-500">
                  <Info className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {t("interactionsautoSubjectNotice")}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="interaction-type">
                  {t("interactionstypeLabel")}
                </label>
                <select
                  id="interaction-type"
                  value={type}
                  onChange={(event) => {
                    const nextType = event.target.value as InteractionType;
                    setType(nextType);
                    if (AUTO_SUBJECT_TYPES.has(nextType)) {
                      setSubjectDirty(false);
                    }
                  }}
                  className="border rounded-md h-9 w-full px-3 text-sm bg-background"
                >
                  {INTERACTION_TYPES.map((value) => (
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
                  {INTERACTION_STATUSES.map((value) => (
                    <option key={value ?? "none"} value={value ?? ""}>
                      {value ? t(`interactionsstatus.${value}`) : t("interactionsstatusNone")}
                    </option>
                  ))}
                </select>
              </div>

              {type === "quote" && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="interaction-quote-amount">
                    {t("interactionsamountLabel")}
                  </label>
                  <Input
                    id="interaction-quote-amount"
                    value={quoteAmount}
                    onChange={(event) => setQuoteAmount(event.target.value)}
                    placeholder={t("interactionsamountPlaceholder")}
                  />
                  <p className="text-xs text-gray-500">{t("interactionsamountHelper")}</p>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="interaction-project">
                  {t("interactionsprojectLabel")}
                </label>
                <select
                  id="interaction-project"
                  value={selectedProjectId ?? ""}
                  onChange={(event) => setSelectedProjectId(event.target.value ? event.target.value : null)}
                  disabled={projectLoading}
                  className="border rounded-md h-9 w-full px-3 text-sm bg-background disabled:opacity-60"
                >
                  <option value="">{t("interactionsprojectNone")}</option>
                  {projectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} · {t(`projects.status.${option.status}`)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">{t("interactionsprojectHelper")}</p>
                {projectError ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{projectError}</div>
                ) : null}
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
            </div>

            <InteractionTagsSelector
              householdId={householdId}
              value={selectedTagIds}
              onChange={setSelectedTagIds}
              inputId="interaction-tags"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t("interactionscontacts.label")}</label>
              <p className="text-xs text-gray-500">{t("interactionscontacts.helper")}</p>
              <ContactSelector
                householdId={householdId}
                value={selectedContactIds}
                onChange={setSelectedContactIds}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t("interactionsstructures.label")}</label>
              <p className="text-xs text-gray-500">{t("interactionsstructures.helper")}</p>
              <StructureSelector
                householdId={householdId}
                value={selectedStructureIds}
                onChange={setSelectedStructureIds}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">{t("interactionssections.meta")}</CardTitle>
            <CardDescription>{zoneHelper}</CardDescription>
          </CardHeader>
          <CardContent>
            {zonesLoading ? (
              <div className="text-sm text-gray-500">{t("common.loading")}</div>
            ) : hasZones ? (
              <ZonePicker zones={zones} value={selectedZones} onChange={setSelectedZones} />
            ) : (
              <div className="text-sm text-gray-500">{t("zones.none")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">{t("interactionssections.description")}</CardTitle>
            <CardDescription>{t("interactionsrawHelper")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder={t("interactionsrawPlaceholder")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">{t("interactionssections.files")}</CardTitle>
            <CardDescription>{t("interactionsdocumentsHelper")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLibraryDocument(doc.id)}
                      >
                        {t("common.remove")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

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
