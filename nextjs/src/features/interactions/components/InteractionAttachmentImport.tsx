// nextjs/src/features/interactions/components/InteractionAttachmentImport.tsx
"use client";

import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DocumentImportButtons from "@interactions/components/DocumentImportButtons";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { DocumentType } from "@interactions/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

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
  const { t } = useI18n();

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
        const { error: linkError } = await client
          .from("documents" as any)
          .insert({
            interaction_id: interactionId,
            file_path: storagePath,
            mime_type: file.type || null,
            type: resolvedType,
            name: file.name || "file",
            notes: "",
            metadata: {
              size: file.size,
              customName: file.name || "file",
            },
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
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
          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("interactions.upload.inProgress")}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
