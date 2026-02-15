// nextjs/src/features/interactions/components/InteractionAttachmentImport.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Link as LinkIcon, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import ExistingDocumentsModal from "@interactions/components/ExistingDocumentsModal";
import type { Document } from "@interactions/types";
import { DesktopUploadInterface } from "@documents/components/DesktopUploadInterface";
import { MobileUploadInterface } from "@documents/components/MobileUploadInterface";
import { StagedFileItem } from "@documents/components/StagedFileItem";
import { useDocumentUpload } from "@documents/hooks/useDocumentUpload";
import { useIsMobile } from "@documents/hooks/useIsMobile";
import { DOCUMENT_TYPES } from "@documents/utils/uploadHelpers";

type InteractionAttachmentImportProps = {
  interactionId?: string;
  onUploaded?: () => void;
};

type DocumentLinkPayload = {
  id: string;
  role?: string | null;
  note?: string | null;
};

export default function InteractionAttachmentImport({ interactionId, onUploaded }: InteractionAttachmentImportProps) {
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const isMobile = useIsMobile();

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const uploadOptions = useMemo(
    () => ({
      storageFolder: interactionId ? () => interactionId : undefined,
      uploadSource: "interaction_attachment_import",
    }),
    [interactionId],
  );

  const {
    stagedFiles,
    uploading,
    error,
    success,
    stageFiles,
    removeStagedFile,
    updateStagedFile,
    uploadFiles,
    canUpload,
    clearStaged,
  } = useDocumentUpload(uploadOptions);

  const typeOptions = useMemo(
    () =>
      DOCUMENT_TYPES.map((value) => ({
        value,
        label: t(`storage.type.${value}` as const),
      })),
    [t],
  );

  const uploadDisabled = !canUpload || uploading || linking;
  const stagedCount = stagedFiles.length;

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      if (!files?.length) return;
      stageFiles(files);
    },
    [stageFiles],
  );

  const linkDocuments = useCallback(
    async (docs: DocumentLinkPayload[]) => {
      if (!interactionId || !docs.length) return;
      setLinking(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const payload = docs.map((doc) => ({
          interaction_id: interactionId,
          document_id: doc.id,
          role: doc.role ?? "attachment",
          note: doc.note ?? "",
        }));
        const { error: linkError } = await client
          .from("interaction_documents")
          .upsert(payload, { onConflict: "interaction_id,document_id" });
        if (linkError) throw linkError;
      } finally {
        setLinking(false);
      }
    },
    [interactionId],
  );

  const handleUpload = useCallback(async () => {
    try {
      const uploadedIds = await uploadFiles();
      if (uploadedIds.length && interactionId) {
        await linkDocuments(uploadedIds.map((id) => ({ id })));
      }
      if (uploadedIds.length) {
        onUploaded?.();
        setOverlayOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert(t("interactions.linkDocumentsFailed") ?? "Impossible de lier les documents.");
    }
  }, [uploadFiles, linkDocuments, onUploaded, t, interactionId]);

  const handleLinkDocuments = useCallback(
    async (docs: Document[]) => {
      if (!interactionId || !docs.length) return;
      try {
        await linkDocuments(
          docs.map((doc) => ({
            id: doc.id,
            role: doc.link_role ?? "attachment",
            note: doc.link_note ?? "",
          })),
        );
        setLibraryOpen(false);
        setOverlayOpen(false);
        onUploaded?.();
      } catch (err) {
        console.error(err);
        alert(t("interactions.linkDocumentsFailed") ?? "Impossible de lier les documents.");
      }
    },
    [linkDocuments, onUploaded, t],
  );

  useEffect(() => {
    if (!overlayOpen) {
      clearStaged();
    }
  }, [overlayOpen, clearStaged]);

  return (
    <>
      <SheetDialog
        trigger={
          <Button
            variant="outline"
            size={"icon"}
            disabled={uploading || linking}
            aria-label={t("interactionsattachments")}
          >
            {(uploading || linking) ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        }
        title={t("interactionsattachments")}
        description={t("interactionsdocumentsHelper")}
        closeLabel={t("common.close")}
        contentClassName="pb-4"
        open={overlayOpen}
        onOpenChange={(next) => setOverlayOpen(next)}
      >
        {({ isMobile }) => (
          <div className="space-y-4">
            {isMobile ? (
              <MobileUploadInterface onFilesSelected={handleFilesSelected} disabled={uploading || linking} />
            ) : (
              <DesktopUploadInterface onFilesSelected={handleFilesSelected} disabled={uploading || linking} />
            )}

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
              <p className="text-sm text-muted-foreground">{t("storage.stageEmpty")}</p>
            ) : (
              <div className="space-y-3">
                {stagedFiles.map((staged) => (
                  <StagedFileItem
                    key={staged.id}
                    staged={staged}
                    typeOptions={typeOptions}
                    onUpdate={(changes) => updateStagedFile(staged.id, changes)}
                    onRemove={() => removeStagedFile(staged.id)}
                  />
                ))}
              </div>
            )}

            <div className="space-y-2 border-t pt-3">
              <Button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploadDisabled}
                className="w-full"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("storage.uploading")}
                  </span>
                ) : stagedCount > 1 ? (
                  t("storage.uploadActionPlural", { count: stagedCount })
                ) : (
                  t("storage.uploadAction", { count: stagedCount })
                )}
              </Button>
              {interactionId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-center gap-2 text-sm"
                  onClick={() => setLibraryOpen(true)}
                  disabled={linking || uploading || !selectedHouseholdId}
                >
                  <LinkIcon className="h-4 w-4" />
                  {t("interactions.linkExistingDocuments")}
                </Button>
              ) : null}
              {(uploading || linking) && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("interactions.upload.inProgress")}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetDialog>

      {interactionId ? (
        <ExistingDocumentsModal
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          householdId={selectedHouseholdId}
          interactionId={interactionId}
          onConfirm={handleLinkDocuments}
        />
      ) : null}
    </>
  );
}
