// nextjs/src/app/app/storage/page.tsx
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { AlertCircle, CheckCircle2, FileDown, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@interactions/types";

const MAX_RECENT_DOCUMENTS = 10;
const DOCUMENT_TYPES: DocumentType[] = ["document", "photo", "quote", "invoice", "contract", "other"];

type StagedFile = {
  id: string;
  file: File;
  name: string;
  type: DocumentType;
};

type RecentDocument = {
  id: string;
  name: string;
  type: DocumentType;
  createdAt: string;
  filePath: string;
};

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSize(bytes: number | undefined) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function StoragePage() {
  const { selectedHouseholdId, user, loading: globalLoading } = useGlobal();
  const { t } = useI18n();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

  const typeOptions = useMemo(
    () =>
      DOCUMENT_TYPES.map((value) => ({
        value,
        label: t(`storage.type.${value}` as const),
      })),
    [t]
  );

  const stageFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files ?? []).filter((file) => file.size > 0);
      if (!fileArray.length) return;
      setError(null);
      setSuccess(null);
      setStagedFiles((prev) => [
        ...prev,
        ...fileArray.map((file) => ({
          id: createLocalId(),
          file,
          name: file.name,
          type: inferDocumentType(file),
        })),
      ]);
    },
    []
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files?.length) {
        stageFiles(event.target.files);
        event.target.value = "";
      }
    },
    [stageFiles]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer?.files?.length) {
        stageFiles(event.dataTransfer.files);
      }
    },
    [stageFiles]
  );

  const removeStagedFile = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const updateStagedFile = useCallback((id: string, changes: Partial<Pick<StagedFile, "name" | "type">>) => {
    setStagedFiles((prev) =>
      prev.map((file) =>
        file.id === id
          ? {
            ...file,
            ...changes,
          }
          : file
      )
    );
  }, []);

  const loadRecentDocuments = useCallback(async () => {
    if (globalLoading) return;

    if (!selectedHouseholdId) {
      setRecentDocuments([]);
      return;
    }

    setRecentLoading(true);
    setRecentError(null);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data, error: supabaseError } = await client
        .from("documents")
        .select("id, name, type, created_at, file_path, metadata")
        .eq("household_id", selectedHouseholdId)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_DOCUMENTS);

      if (supabaseError) throw supabaseError;

      const normalized: RecentDocument[] = (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.name as string) ?? "",
        type: (row.type as DocumentType) ?? "document",
        createdAt: (row.created_at as string) ?? "",
        filePath: (row.file_path as string) ?? "",
      }));
      setRecentDocuments(normalized);
    } catch (loadErr: unknown) {
      console.error(loadErr);
      setRecentError(t("storage.recentLoadFailed"));
      setRecentDocuments([]);
    } finally {
      setRecentLoading(false);
    }
  }, [globalLoading, selectedHouseholdId, t]);

  useEffect(() => {
    void loadRecentDocuments();
  }, [loadRecentDocuments]);

  useEffect(() => {
    if (!highlightedIds.length) return;
    const timeout = setTimeout(() => setHighlightedIds([]), 6000);
    return () => clearTimeout(timeout);
  }, [highlightedIds]);

  const handleUpload = useCallback(async () => {
    if (!selectedHouseholdId) {
      setError(t("storage.noHousehold"));
      return;
    }

    if (!stagedFiles.length) {
      setError(t("storage.noFilesStaged"));
      return;
    }

    if (stagedFiles.some((file) => !file.type)) {
      setError(t("storage.typeRequired"));
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      let userId = user?.id ?? null;
      if (!userId) {
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        userId = authData?.user?.id ?? null;
      }
      if (!userId) {
        throw new Error(t("storage.noUser"));
      }

      const createdIds: string[] = [];

      for (const staged of stagedFiles) {
        const safeName = sanitizeFilename(staged.file.name || staged.name);
        const uniquePrefix =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const storagePath = `${userId}/documents/${uniquePrefix}_${safeName}`;

        const { error: uploadError } = await client.storage.from("files").upload(storagePath, staged.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: staged.file.type || undefined,
        });
        if (uploadError) throw uploadError;

        const { data: insertedDoc, error: insertError } = await client
          .from("documents")
          .insert({
            household_id: selectedHouseholdId,
            file_path: storagePath,
            mime_type: staged.file.type || null,
            type: staged.type,
            name: staged.name?.trim() || staged.file.name,
            notes: "",
            metadata: {
              size: staged.file.size,
              originalName: staged.file.name,
              quickUpload: true,
            },
          })
          .select("id")
          .single();

        if (insertError || !insertedDoc) {
          throw insertError ?? new Error(t("storage.insertDocumentFailed"));
        }

        createdIds.push((insertedDoc as { id: string }).id);
      }

      const successKey =
        stagedFiles.length > 1 ? "storage.uploadSuccessPlural" : "storage.uploadSuccessSingle";
      setSuccess(t(successKey, { count: stagedFiles.length }));
      setStagedFiles([]);
      setHighlightedIds(createdIds);
      await loadRecentDocuments();
    } catch (uploadErr: unknown) {
      console.error(uploadErr);
      setError(t("storage.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }, [loadRecentDocuments, stagedFiles, selectedHouseholdId, t, user?.id]);

  const handleDownload = useCallback(
    async (doc: RecentDocument) => {
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const { data, error: signedError } = await client.storage
          .from("files")
          .createSignedUrl(doc.filePath, 60);
        if (signedError || !data?.signedUrl) {
          throw signedError ?? new Error("missing signed url");
        }

        const url = data.signedUrl;
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.click();
      } catch (downloadErr: unknown) {
        console.error(downloadErr);
        setError(t("storage.downloadFailed"));
      }
    },
    [t]
  );

  const stagedCount = stagedFiles.length;
  const uploadDisabled = uploading || !stagedFiles.length || globalLoading;

  return (
    <AppPageLayout
      title={t("storage.title")}
      subtitle={t("storage.subtitle")}
      actions={[{
        label: t("storage.viewDocuments"),
        href: "/app/documents",
        icon: FileText,
        variant: "outline",
        size: "sm",
      }]}
      hideBackButton
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("storage.uploadCardTitle")}</CardTitle>
            <CardDescription>{t("storage.uploadCardSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="storage-file-input"
              onDrop={handleDrop}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center transition",
                "hover:border-primary-300 hover:bg-primary-50/50",
                globalLoading && "pointer-events-none opacity-60"
              )}
            >
              <UploadCloud className="h-10 w-10 text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-base font-medium text-gray-900">{t("storage.dropLabel")}</p>
                <p className="text-sm text-gray-500">{t("storage.dropHelper")}</p>
              </div>
              <Input
                ref={fileInputRef}
                id="storage-file-input"
                type="file"
                multiple
                className="sr-only"
                onChange={handleInputChange}
                disabled={globalLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={globalLoading}
              >
                {t("storage.chooseFiles")}
              </Button>
            </label>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {stagedFiles.length === 0 ? (
              <p className="text-sm text-gray-500">{t("storage.stageEmpty")}</p>
            ) : (
              <div className="space-y-4">
                {stagedFiles.map((staged) => (
                  <div
                    key={staged.id}
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
                  >
                    <div className="flex flex-1 flex-col gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600" htmlFor={`name-${staged.id}`}>
                          {t("storage.fields.nameLabel")}
                        </label>
                        <Input
                          id={`name-${staged.id}`}
                          value={staged.name}
                          onChange={(event) => updateStagedFile(staged.id, { name: event.target.value })}
                          autoComplete="off"
                          className="mt-1"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {staged.file.name} · {formatSize(staged.file.size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600" htmlFor={`type-${staged.id}`}>
                          {t("storage.fields.typeLabel")}
                        </label>
                        <select
                          id={`type-${staged.id}`}
                          value={staged.type}
                          onChange={(event) =>
                            updateStagedFile(staged.id, { type: event.target.value as DocumentType })
                          }
                          className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                        >
                          {typeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStagedFile(staged.id)}
                        className="self-start text-gray-500 hover:text-red-600"
                        aria-label={t("common.remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end border-t pt-4">
              <Button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploadDisabled}
                className="min-w-[10rem]"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("storage.uploading")}
                  </span>
                ) : stagedCount > 1 ? (
                  t("storage.uploadActionPlural", { count: stagedCount })
                ) : (
                  t("storage.uploadAction", { count: stagedCount })
                )}
              </Button>
            </div>
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
                        "flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition md:flex-row md:items-center md:justify-between",
                        highlighted && "border-primary-300 bg-primary-50"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {t(`storage.type.${doc.type}` as const)} · {formatDate(doc.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => void handleDownload(doc)}>
                          <span className="flex items-center gap-2">
                            <FileDown className="h-4 w-4" aria-hidden="true" />
                            {t("storage.download")}
                          </span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-end">
              <Link href="/app/documents">
                <Button variant="ghost" size="sm">
                  {t("storage.viewDocuments")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppPageLayout>
  );
}
