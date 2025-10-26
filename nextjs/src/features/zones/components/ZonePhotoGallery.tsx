"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Link as LinkIcon, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import AddDocumentsModal, { type StagedDocument } from "@documents/components/AddDocumentModal";
import ExistingDocumentsModal from "@interactions/components/ExistingDocumentsModal";
import type { Document } from "@interactions/types";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";

type ZoneDocumentRow = {
  document_id: string;
  note: string | null;
  role: string | null;
  created_at: string;
  document: {
    id: string;
    household_id: string;
    file_path: string;
    name: string | null;
    notes: string | null;
    mime_type: string | null;
    type: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    created_by: string | null;
  } | null;
};

type ZonePhotoGalleryProps = {
  zoneId: string;
  householdId?: string | null;
};

const sanitizeFilename = (value: string) => value.replace(/[^0-9a-zA-Z._-]/g, "_");

export function ZonePhotoGallery({ zoneId, householdId }: ZonePhotoGalleryProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const [photos, setPhotos] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const { previews, error: previewError } = useSignedFilePreviews(photos);

  const canManage = Boolean(householdId);

  const loadPhotos = useCallback(async () => {
    if (!householdId) {
      setPhotos([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: fetchError } = await client
        .from("zone_documents")
        .select(
          `
          document_id,
          note,
          role,
          created_at,
          document:documents (
            id,
            household_id,
            file_path,
            name,
            notes,
            mime_type,
            type,
            metadata,
            created_at,
            created_by
          )
        `
        )
        .eq("zone_id", zoneId)
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;

      const mapped: Document[] = (data ?? [])
        .map((row) => row as ZoneDocumentRow)
        .filter((row) => row.document)
        .map((row) => ({
          id: row.document!.id,
          household_id: row.document!.household_id,
          file_path: row.document!.file_path,
          name: row.document!.name ?? "",
          notes: row.document!.notes ?? "",
          mime_type: row.document!.mime_type ?? null,
          type: "photo",
          metadata: row.document!.metadata ?? null,
          created_at: row.document!.created_at,
          created_by: row.document!.created_by ?? null,
          link_role: row.role,
          link_note: row.note,
          link_created_at: row.created_at,
        }));
      setPhotos(mapped);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("zones.photos.loadFailed");
      setError(message);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [householdId, t, zoneId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const handleUpload = useCallback(
    async (staged: StagedDocument[]) => {
      if (!householdId || staged.length === 0) return;
      setWorking(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        const userId = userData.user?.id;
        if (!userId) throw new Error(t("auth.notAuthenticated"));

        for (const item of staged) {
          const safeBaseName = sanitizeFilename(item.name || item.file.name || "photo");
          const uniquePrefix =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = `${userId}/zones/${zoneId}/${uniquePrefix}_${safeBaseName}`;

          const { error: uploadError } = await client.storage
            .from("files")
            .upload(storagePath, item.file, { cacheControl: "3600", upsert: false, contentType: item.file.type || undefined });
          if (uploadError) throw uploadError;

          const { data: insertedDoc, error: insertError } = await client
            .from("documents")
            .insert({
              household_id: householdId,
              file_path: storagePath,
              mime_type: item.file.type || null,
              type: "photo",
              name: item.name || item.file.name,
              notes: item.notes ?? "",
              metadata: {
                size: item.file.size,
                originalName: item.file.name,
              },
            })
            .select("id")
            .single();
          if (insertError) throw insertError;
          const documentId = insertedDoc?.id;
          if (!documentId) throw new Error("Document creation failed");

          const { error: linkError } = await client.from("zone_documents").insert({
            zone_id: zoneId,
            document_id: documentId,
            role: "photo",
            note: item.notes ?? "",
          });
          if (linkError) throw linkError;
        }

        show({ title: t("zones.photos.uploadSuccess"), variant: "success" });
        await loadPhotos();
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : t("zones.photos.uploadFailed");
        show({ title: t("zones.photos.uploadFailed"), description: message, variant: "error" });
      } finally {
        setWorking(false);
      }
    },
    [householdId, loadPhotos, show, t, zoneId]
  );

  const handleLinkExisting = useCallback(
    async (docs: Document[]) => {
      if (!docs.length) return;
      setWorking(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const payload = docs.map((doc) => ({
          zone_id: zoneId,
          document_id: doc.id,
          role: "photo",
          note: doc.notes ?? "",
        }));
        const { error: upsertError } = await client
          .from("zone_documents")
          .upsert(payload, { onConflict: "zone_id,document_id" });
        if (upsertError) throw upsertError;
        show({ title: t("zones.photos.linkSuccess"), variant: "success" });
        await loadPhotos();
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : t("zones.photos.linkFailed");
        show({ title: t("zones.photos.linkFailed"), description: message, variant: "error" });
      } finally {
        setWorking(false);
      }
    },
    [loadPhotos, show, t, zoneId]
  );

  const handleDetach = useCallback(
    async (documentId: string) => {
      setWorking(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error: deleteError } = await client
          .from("zone_documents")
          .delete()
          .eq("zone_id", zoneId)
          .eq("document_id", documentId);
        if (deleteError) throw deleteError;
        setPhotos((prev) => prev.filter((doc) => doc.id !== documentId));
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : t("zones.photos.unlinkFailed");
        show({ title: t("zones.photos.unlinkFailed"), description: message, variant: "error" });
      } finally {
        setWorking(false);
      }
    },
    [show, t, zoneId]
  );

  const infoText = useMemo(() => {
    if (error) return error;
    if (!photos.length && !loading) return t("zones.photos.empty");
    return null;
  }, [error, loading, photos.length, t]);

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-500" />
            {t("zones.photos.title")}
          </p>
          <p className="text-xs text-slate-500">{t("zones.photos.helper")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLibraryOpen(true)}
            disabled={!canManage || working}
          >
            <LinkIcon className="mr-1 h-3.5 w-3.5" />
            {t("zones.photos.linkExisting")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setUploadOpen(true)}
            disabled={!canManage || working}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            {t("zones.photos.addNew")}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : null}

        {infoText ? <p className="text-sm text-slate-500">{infoText}</p> : null}
        {previewError && <p className="text-xs text-red-600">{previewError}</p>}

        {photos.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => {
              const preview = previews[photo.id];
              return (
                <div
                  key={photo.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative h-48 bg-slate-100">
                    {preview?.view ? (
                      <Image
                        src={preview.view}
                        alt={photo.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
                    <p className="font-medium truncate">{photo.name}</p>
                    <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
                      <a
                        href={preview?.download ?? preview?.view ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline disabled:cursor-not-allowed"
                      >
                        {t("zones.photos.openPhoto")}
                      </a>
                      <button
                        type="button"
                        className="text-red-600 hover:underline disabled:cursor-not-allowed"
                        onClick={() => handleDetach(photo.id)}
                        disabled={working}
                      >
                        {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("common.delete")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddDocumentsModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        householdId={householdId ?? ""}
        mode="staging"
        onStagedChange={(docs) => {
          setUploadOpen(false);
          void handleUpload(docs);
        }}
        allowedTypes={["photo"]}
        defaultType="photo"
      />

      <ExistingDocumentsModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        householdId={householdId}
        onConfirm={async (docs) => {
          await handleLinkExisting(docs);
        }}
        allowedTypes={["photo"]}
        excludeDocumentIds={photos.map((photo) => photo.id)}
      />
    </div>
  );
}

export default ZonePhotoGallery;
