"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Sparkles, UploadCloud } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useZones } from "@zones/hooks/useZones";
import type { Zone } from "@zones/types";
import type { DocumentType } from "@interactions/types";

const MAX_RECENT_DOCUMENTS = 10;

type TagOption = { id: string; name: string };
type ContactOption = { id: string; label: string };
type StructureOption = { id: string; name: string };

type RecentDocument = {
  id: string;
  name: string;
  type: DocumentType;
  createdAt: string;
  interactionId: string;
  interactionSubject: string;
};

type FlatZone = {
  id: string;
  name: string;
  depth: number;
};

type TagRow = {
  id: string;
  name: string | null;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type StructureRow = {
  id: string;
  name: string | null;
};

type DocumentRow = {
  id: string;
  name: string | null;
  type: DocumentType | null;
  created_at: string;
  interaction_id: string | null;
};

type InteractionRow = {
  id: string;
  subject: string | null;
  household_id: string;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^0-9a-zA-Z._-]/g, "_");
}

function inferDocumentType(file: File): DocumentType {
  if (file.type?.startsWith("image/")) return "photo";
  const lower = file.name.toLowerCase();
  if (/(devis|quote)/i.test(lower)) return "quote";
  if (/(facture|invoice)/i.test(lower)) return "invoice";
  if (/(contrat|contract)/i.test(lower)) return "contract";
  return "document";
}

function fileBaseName(name: string) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot > 0) {
    return name.slice(0, lastDot).trim();
  }
  return name.trim();
}

function flattenZones(zones: Zone[]): FlatZone[] {
  const byParent = new Map<string | null, Zone[]>();
  zones.forEach((zone) => {
    const parentKey = zone.parent_id ?? null;
    const list = byParent.get(parentKey) ?? [];
    list.push(zone);
    byParent.set(parentKey, list);
  });
  byParent.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

  const result: FlatZone[] = [];
  const visited = new Set<string>();

  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    children.forEach((child) => {
      if (visited.has(child.id)) return;
      visited.add(child.id);
      result.push({ id: child.id, name: child.name, depth });
      walk(child.id, depth + 1);
    });
  }

  walk(null, 0);

  // Include orphans if any
  zones.forEach((zone) => {
    if (!visited.has(zone.id)) {
      result.push({ id: zone.id, name: zone.name, depth: 0 });
    }
  });

  return result;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function QuickDocumentUploadPage() {
  const { selectedHouseholdId, user, loading: globalLoading } = useGlobal();
  const { t } = useI18n();

  const { zones, loading: zonesLoading, error: zonesError } = useZones(globalLoading ? null : selectedHouseholdId);
  const flatZones = useMemo(() => flattenZones(zones), [zones]);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedZoneId && flatZones.length) {
      setSelectedZoneId(flatZones[0].id);
    }
  }, [flatZones, selectedZoneId]);

  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedStructureId, setSelectedStructureId] = useState<string>("");
  const [note, setNote] = useState("");

  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [showEnrichment, setShowEnrichment] = useState(false);

  useEffect(() => {
    if (!availableTags.length) return;
    setSelectedTagIds((prev) => prev.filter((id) => availableTags.some((tag) => tag.id === id)));
  }, [availableTags]);

  useEffect(() => {
    if (contacts.length === 0) {
      setSelectedContactId("");
    } else if (selectedContactId && !contacts.some((contact) => contact.id === selectedContactId)) {
      setSelectedContactId("");
    }
  }, [contacts, selectedContactId]);

  useEffect(() => {
    if (structures.length === 0) {
      setSelectedStructureId("");
    } else if (selectedStructureId && !structures.some((structure) => structure.id === selectedStructureId)) {
      setSelectedStructureId("");
    }
  }, [structures, selectedStructureId]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setAvailableTags([]);
      setContacts([]);
      setStructures([]);
      setMetaLoading(false);
      setMetaError(null);
      return;
    }

    let active = true;
    setMetaLoading(true);
    setMetaError(null);
    (async () => {
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const [tagsResult, contactsResult, structuresResult] = await Promise.all([
          client
            .from("tags")
            .select("id, name")
            .eq("household_id", selectedHouseholdId)
            .eq("type", "interaction")
            .order("name", { ascending: true }),
          client
            .from("contacts")
            .select("id, first_name, last_name")
            .eq("household_id", selectedHouseholdId)
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true }),
          client
            .from("structures")
            .select("id, name")
            .eq("household_id", selectedHouseholdId)
            .order("name", { ascending: true }),
        ]);

        if (!active) return;

        if (tagsResult.error) throw tagsResult.error;
        if (contactsResult.error) throw contactsResult.error;
        if (structuresResult.error) throw structuresResult.error;

        const tagRows = (tagsResult.data ?? []) as TagRow[];
        const tagOptions = tagRows.map((row) => ({
          id: row.id,
          name: row.name ?? "",
        }));

        const contactRows = (contactsResult.data ?? []) as ContactRow[];
        const contactItems = contactRows.map((row) => {
          const first = (row.first_name ?? "").trim();
          const last = (row.last_name ?? "").trim();
          const label = [first, last].filter(Boolean).join(" ") || t("storage.unnamedContact");
          return { id: row.id, label };
        });

        const structureRows = (structuresResult.data ?? []) as StructureRow[];
        const structureItems = structureRows.map((row) => ({
          id: row.id,
          name: (row.name ?? "").trim() || t("storage.unnamedStructure"),
        }));

        setAvailableTags(tagOptions);
        setContacts(contactItems);
        setStructures(structureItems);
      } catch (loadError: unknown) {
        console.error(loadError);
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : t("storage.metadataLoadFailed");
        setMetaError(message);
        setAvailableTags([]);
        setContacts([]);
        setStructures([]);
      } finally {
        if (active) {
          setMetaLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedHouseholdId, t]);

  const loadRecentDocuments = useCallback(async () => {
    if (globalLoading) {
      return;
    }

    if (!selectedHouseholdId) {
      setRecentDocuments([]);
      return;
    }

    setRecentLoading(true);
    setRecentError(null);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: docsData, error: docsError } = await client
        .from("documents")
        .select("id, name, type, created_at, interaction_id")
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_DOCUMENTS);

      if (docsError) throw docsError;
      const docRows = (docsData ?? []) as DocumentRow[];

      const interactionIds = docRows
        .map((row) => row.interaction_id)
        .filter((id): id is string => Boolean(id));

      let interactionMap = new Map<string, InteractionRow>();

      if (interactionIds.length > 0) {
        const { data: interactionsData, error: interactionsError } = await client
          .from("interactions")
          .select("id, subject, household_id")
          .in("id", interactionIds);
        if (interactionsError) throw interactionsError;
        const interactions = (interactionsData ?? []) as InteractionRow[];
        interactionMap = new Map(interactions.map((row) => [row.id, row]));
      }

      const normalized: RecentDocument[] = docRows
        .filter(
          (row) => {
            if (!row.interaction_id) return false;
            const interaction = interactionMap.get(row.interaction_id);
            if (!interaction) return false;
            if (selectedHouseholdId && interaction.household_id !== selectedHouseholdId) return false;
            return true;
          }
        )
        .map((row) => {
          const interaction = interactionMap.get(row.interaction_id!);
          return {
            id: row.id,
            name: row.name ?? "",
            type: row.type ?? "document",
            createdAt: row.created_at,
            interactionId: row.interaction_id!,
            interactionSubject: interaction?.subject ?? "",
          };
        });

      setRecentDocuments(normalized);
    } catch (loadErr: unknown) {
      console.error(loadErr);
      const message = loadErr instanceof Error ? loadErr.message : t("storage.recentLoadFailed");
      setRecentError(message);
      setRecentDocuments([]);
    } finally {
      setRecentLoading(false);
    }
  }, [globalLoading, selectedHouseholdId, t]);

  useEffect(() => {
    loadRecentDocuments();
  }, [loadRecentDocuments]);

  useEffect(() => {
    if (!highlightedIds.length) return;
    const timeout = setTimeout(() => setHighlightedIds([]), 6000);
    return () => clearTimeout(timeout);
  }, [highlightedIds]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files ?? []).filter((file) => file.size > 0);
      if (!fileArray.length) return;

      if (globalLoading) {
        return;
      }

      if (!selectedHouseholdId) {
        setError(t("storage.noHousehold"));
        return;
      }

      if (!selectedZoneId) {
        setError(t("storage.zoneRequired"));
        return;
      }

      setError(null);
      setSuccess(null);
      setPendingFiles(fileArray.map((file) => file.name));
      setUploading(true);

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        let userId = user?.id ?? null;
        if (!userId) {
          const { data: authData, error: authErr } = await client.auth.getUser();
          if (authErr) throw authErr;
          userId = authData?.user?.id ?? null;
        }
        if (!userId) {
          throw new Error(t("storage.noUser"));
        }

        const createdDocumentIds: string[] = [];

        for (const file of fileArray) {
          const subject = fileBaseName(file.name) || t("storage.defaultSubject");
          const content = note.trim();
          const { data: createdId, error: createErr } = await client.rpc("create_interaction_with_zones", {
            p_household_id: selectedHouseholdId,
            p_subject: subject,
            p_zone_ids: [selectedZoneId],
            p_content: content,
            p_type: "document",
            p_status: "done",
            p_contact_id: selectedContactId || null,
            p_structure_id: selectedStructureId || null,
            p_tag_ids: selectedTagIds.length ? selectedTagIds : null,
          });
          if (createErr || !createdId) {
            throw createErr ?? new Error(t("storage.createInteractionFailed"));
          }

          const interactionId = typeof createdId === "string" ? createdId : (createdId as string);
          const safeBase = sanitizeFilename(file.name || subject);
          const uniquePrefix =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = `${userId}/${interactionId}/${uniquePrefix}_${safeBase}`;

          const { error: uploadErr } = await client.storage.from("files").upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
          if (uploadErr) throw uploadErr;

          const documentType = inferDocumentType(file);
          const { data: insertedDoc, error: docErr } = await client
            .from("documents")
            .insert({
              interaction_id: interactionId,
              file_path: storagePath,
              mime_type: file.type || null,
              type: documentType,
              name: file.name,
              notes: "",
              metadata: {
                size: file.size,
                originalName: file.name,
                quickUpload: true,
              },
            })
            .select("id")
            .single();
          if (docErr || !insertedDoc) {
            throw docErr ?? new Error(t("storage.insertDocumentFailed"));
          }

          createdDocumentIds.push(insertedDoc.id as string);
        }

        const successKey = fileArray.length > 1 ? "storage.quickUploadSuccessPlural" : "storage.quickUploadSuccessSingle";
        setSuccess(t(successKey, { count: fileArray.length }));
        await loadRecentDocuments();
        setHighlightedIds(createdDocumentIds);
      } catch (uploadErr: unknown) {
        console.error(uploadErr);
        const message =
          uploadErr instanceof Error ? uploadErr.message : t("storage.quickUploadFailed");
        setError(message);
      } finally {
        setUploading(false);
        setPendingFiles([]);
      }
    },
    [
      loadRecentDocuments,
      note,
      selectedContactId,
      selectedHouseholdId,
      selectedStructureId,
      selectedTagIds,
      selectedZoneId,
      t,
      globalLoading,
      user?.id,
    ]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files?.length) {
        void handleFiles(files);
        event.target.value = "";
      }
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer?.files;
      if (files?.length) {
        void handleFiles(files);
      }
    },
    [handleFiles]
  );

  const disableUpload = uploading || globalLoading || !selectedHouseholdId || !selectedZoneId;

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("storage.title")}</CardTitle>
          <CardDescription>{t("storage.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {!globalLoading && !selectedHouseholdId && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{t("storage.noHousehold")}</AlertDescription>
            </Alert>
          )}

          {zonesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{zonesError}</AlertDescription>
            </Alert>
          )}

          <section className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="quick-doc-zone">
              {t("storage.zoneLabel")}
            </label>
            <p className="text-xs text-gray-500">{t("storage.zoneHelper")}</p>

            {globalLoading || zonesLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("common.loading")}
              </div>
            ) : flatZones.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
                {t("storage.noZones")}
              </div>
            ) : (
              <select
                id="quick-doc-zone"
                value={selectedZoneId ?? ""}
                onChange={(event) => setSelectedZoneId(event.target.value || null)}
                disabled={globalLoading || zonesLoading}
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                {flatZones.map((zone) => {
                  const prefix = "  ".repeat(zone.depth);
                  return (
                    <option key={zone.id} value={zone.id}>
                      {`${prefix}${zone.name}`}
                    </option>
                  );
                })}
              </select>
            )}
          </section>

          <section>
            <label
              htmlFor="quick-doc-uploader"
              onDrop={handleDrop}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/70 px-6 py-10 text-center transition hover:border-primary-300 hover:bg-primary-50",
                disableUpload && "cursor-not-allowed opacity-70"
              )}
            >
              <UploadCloud className="mb-3 h-10 w-10 text-primary-500" aria-hidden="true" />
              <p className="text-base font-medium text-primary-900">
                {uploading ? t("storage.uploading") : t("storage.dragOrClick")}
              </p>
              <p className="mt-1 text-sm text-primary-700">{t("storage.uploadHint")}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-primary-700">
                {pendingFiles.map((filename) => (
                  <span key={filename} className="rounded-full bg-primary-100 px-3 py-1 font-medium">
                    {t("storage.processingFile", { name: filename })}
                  </span>
                ))}
              </div>

              <input
                id="quick-doc-uploader"
                type="file"
                disabled={disableUpload}
                onChange={handleInputChange}
                className="hidden"
                multiple
              />
            </label>
          </section>

          <section className="space-y-4">
            <button
              type="button"
              onClick={() => setShowEnrichment((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-500" aria-hidden="true" />
                {t("storage.enrichmentTitle")}
              </span>
              <span className="text-xs text-gray-500">
                {showEnrichment ? t("storage.enrichmentHide") : t("storage.enrichmentShow")}
              </span>
            </button>

            {showEnrichment && (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">{t("storage.enrichmentDescription")}</p>

                {metaError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{metaError}</AlertDescription>
                  </Alert>
                )}

                {metaLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("storage.metadataLoading")}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">{t("storage.tagsLabel")}</p>
                      {availableTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map((tag) => {
                            const selected = selectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                                  selected
                                    ? "border-primary-200 bg-primary-100 text-primary-800 shadow-sm"
                                    : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                                aria-pressed={selected}
                              >
                                #{tag.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">{t("storage.noTags")}</p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="quick-doc-contact">
                          {t("storage.contactLabel")}
                        </label>
                        <select
                          id="quick-doc-contact"
                          value={selectedContactId}
                          onChange={(event) => setSelectedContactId(event.target.value)}
                          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        >
                          <option value="">{t("storage.contactPlaceholder")}</option>
                          {contacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="quick-doc-structure">
                          {t("storage.structureLabel")}
                        </label>
                        <select
                          id="quick-doc-structure"
                          value={selectedStructureId}
                          onChange={(event) => setSelectedStructureId(event.target.value)}
                          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        >
                          <option value="">{t("storage.structurePlaceholder")}</option>
                          {structures.map((structure) => (
                            <option key={structure.id} value={structure.id}>
                              {structure.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700" htmlFor="quick-doc-note">
                        {t("storage.noteLabel")}
                      </label>
                      <Textarea
                        id="quick-doc-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        placeholder={t("storage.notePlaceholder")}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("storage.recentUploadsTitle")}</CardTitle>
          <CardDescription>{t("storage.recentUploadsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{recentError}</AlertDescription>
            </Alert>
          )}

          {recentLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("common.loading")}
            </div>
          ) : recentDocuments.length === 0 ? (
            <p className="text-sm text-gray-500">{t("storage.recentNone")}</p>
          ) : (
            <ul className="space-y-3">
              {recentDocuments.map((doc) => {
                const highlighted = highlightedIds.includes(doc.id);
                return (
                  <li
                    key={doc.id}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:bg-primary-50/60 md:flex-row md:items-center md:justify-between",
                      highlighted && "border-primary-300 bg-primary-50"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        {doc.type} · {formatDate(doc.createdAt)}
                      </p>
                      {doc.interactionSubject && (
                        <p className="text-xs text-gray-500">
                          {t("storage.interactionSubjectLabel", { subject: doc.interactionSubject })}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2 md:mt-0">
                      <Link href={`/app/interactions/${doc.interactionId}`} className="inline-flex">
                        <Button variant="outline" size="sm">
                          {t("storage.openInteraction")}
                        </Button>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
