// nextjs/src/features/interactions/components/InteractionAttachmentImport.tsx
"use client";

import { useState } from "react";
import { Upload, X, Loader2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DocumentImportButtons from "@interactions/components/DocumentImportButtons";
import ExistingDocumentsModal from "@interactions/components/ExistingDocumentsModal";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Document, DocumentType } from "@interactions/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";

type InteractionAttachmentImportProps = {
  interactionId: string;
  onUploaded?: () => void;
};

export default function InteractionAttachmentImport({
  interactionId,
  onUploaded,
}: InteractionAttachmentImportProps) {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();

  const inferType = (file: File): DocumentType =>
    file.type && file.type.startsWith("image/") ? "photo" : "document";

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      if (!selectedHouseholdId) {
        throw new Error(t("storage.noHousehold"));
      }

      for (const file of files) {
        const safeName = (file.name || "file").replace(/[^0-9a-zA-Z._-]/g, "_");
        const uniqueId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
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

        const resolvedType: DocumentType = inferType(file);
        const { data: document, error: documentError } = await client
          .from("documents" as any)
          .insert({
            household_id: selectedHouseholdId,
            file_path: storagePath,
            mime_type: file.type || null,
            type: resolvedType,
            name: file.name || "file",
            notes: "",
            metadata: {
              size: file.size,
              customName: file.name || "file",
            },
          })
          .select("id")
          .single();
        if (documentError) throw documentError;

        const documentId = document?.id as string | undefined;
        if (!documentId) throw new Error("Failed to create document");

        const { error: linkError } = await client
          .from("interaction_documents")
          .insert({
            interaction_id: interactionId,
            document_id: documentId,
            role: "attachment",
            note: "",
          });
        if (linkError) throw linkError;
      }

      setOpen(false);
      onUploaded?.();
    } catch (e) {
      console.error(e);
      alert("Le téléversement a échoué.");
    } finally {
      setUploading(false);
    }
  };

  const handleLinkDocuments = async (docs: Document[]) => {
    if (!docs.length) return;
    setUploading(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const payload = docs.map((doc) => ({
        interaction_id: interactionId,
        document_id: doc.id,
        role: doc.link_role ?? "attachment",
        note: doc.link_note ?? "",
      }));

      const { error: linkError } = await client
        .from("interaction_documents")
        .upsert(payload, { onConflict: "interaction_id,document_id" });
      if (linkError) throw linkError;

      setLibraryOpen(false);
      setOpen(false);
      onUploaded?.();
    } catch (e) {
      console.error(e);
      alert(t("interactions.linkDocumentsFailed") ?? "Impossible de lier les documents.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            aria-label="Ajouter des fichiers"
            className="hover:bg-muted transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-auto rounded-xl border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95"
        >

          <div className="space-y-2">
            <DocumentImportButtons onFilesSelected={handleFilesSelected} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setLibraryOpen(true)}
              disabled={uploading || !selectedHouseholdId}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              {t("interactions.linkExistingDocuments")}
            </Button>
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("interactions.upload.inProgress")}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ExistingDocumentsModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        householdId={selectedHouseholdId}
        interactionId={interactionId}
        onConfirm={handleLinkDocuments}
      />
    </>
  );
}
