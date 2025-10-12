"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocumentImportButtons from "@entries/components/DocumentImportButtons";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { EntryFileType } from "@entries/types";

type EntryAttachmentImportProps = {
  entryId: string;
  onUploaded?: () => void;
};

export default function EntryAttachmentImport({ entryId, onUploaded }: EntryAttachmentImportProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // basic click-outside/escape handling for the lightweight popover
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const inferType = (file: File): EntryFileType =>
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

      const uploadedPaths: string[] = [];

      for (const file of files) {
        const safeName = (file.name || "file").replace(/[^0-9a-zA-Z._-]/g, "_");
        const uniqueId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const storagePath = `${userId}/${entryId}/${uniqueId}_${safeName}`;

        const { error: uploadError } = await client.storage
          .from("files")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);

        const resolvedType: EntryFileType = inferType(file);
        const { error: linkError } = await client
          .from("entry_files" as any)
          .insert({
            entry_id: entryId,
            storage_path: storagePath,
            mime_type: file.type || null,
            type: resolvedType,
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
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <Button ref={btnRef} variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} disabled={uploading}>
        <Upload />
      </Button>
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 z-20 mt-2 w-[260px] rounded-md border border-gray-200 bg-white p-3 shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Ajouter des fichiers</span>
            <button className="p-1 text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DocumentImportButtons onFilesSelected={handleFilesSelected} />
          {uploading && (
            <div className="mt-2 text-xs text-gray-500">Téléversement en cours…</div>
          )}
        </div>
      )}
    </div>
  );
}

