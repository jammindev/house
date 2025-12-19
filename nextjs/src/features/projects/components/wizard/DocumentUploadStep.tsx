"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import type { UploadedDocument } from "../../types";
import { Upload, X, FileIcon, ImageIcon, FileTextIcon, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DocumentUploadStepProps {
  documents: UploadedDocument[];
  onUpdate: (documents: UploadedDocument[]) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUploadStep({
  documents,
  onUpdate,
  onNext,
  onBack,
  onCancel,
}: DocumentUploadStepProps) {
  const { t } = useI18n();
  const { user } = useGlobal();
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return t("projects.wizard.uploadError", { error: "File type not accepted" });
    }
    if (file.size > MAX_FILE_SIZE) {
      return t("projects.wizard.uploadError", { error: "File too large" });
    }
    return null;
  };

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!user?.id) {
      show({ title: t("projects.wizard.uploadError", { error: "Not authenticated" }), variant: "error" });
      return;
    }

    setUploading(true);
    const newDocuments: UploadedDocument[] = [];

    try {
      const supabase = await createSPASassClientAuthenticated();
      const client = supabase.getSupabaseClient();

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Validate file
        const error = validateFile(file);
        if (error) {
          show({ title: error, variant: "error" });
          continue;
        }

        // Generate unique ID for document
        const docId = crypto.randomUUID();
        const sanitizedName = file.name.replace(/[^0-9a-zA-Z._-]/g, "_");
        const storagePath = `${user.id}/projects/${docId}_${sanitizedName}`;

        // Upload to storage
        const { error: uploadError } = await client.storage
          .from("files")
          .upload(storagePath, file);

        if (uploadError) {
          show({
            title: t("projects.wizard.uploadError", { error: uploadError.message }),
            variant: "error"
          });
          continue;
        }

        // Add to documents list
        newDocuments.push({
          id: docId,
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedUrl: storagePath,
        });
      }

      if (newDocuments.length > 0) {
        onUpdate([...documents, ...newDocuments]);
        show({ title: t("projects.wizard.uploadSuccess"), variant: "success" });
      }
    } catch (error) {
      console.error("Upload error:", error);
      show({
        title: t("projects.wizard.uploadError", {
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        variant: "error"
      });
    } finally {
      setUploading(false);
    }
  }, [user, documents, onUpdate, show, t, validateFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const handleRemove = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc?.uploadedUrl) return;

    try {
      const supabase = await createSPASassClientAuthenticated();
      const client = supabase.getSupabaseClient();
      await client.storage.from("files").remove([doc.uploadedUrl]);
      onUpdate(documents.filter((d) => d.id !== docId));
    } catch (error) {
      console.error("Error removing file:", error);
      show({ title: "Error removing file", variant: "error" });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (type === "application/pdf") return <FileTextIcon className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">{t("projects.wizard.uploadDocuments")}</h4>
          <p className="text-sm text-muted-foreground">
            {t("projects.wizard.uploadHint")}
          </p>
        </div>

        {/* Upload area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES.join(",")}
            onChange={handleChange}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t("projects.wizard.dropFiles")}</p>
              <p className="text-xs text-muted-foreground">
                {t("projects.wizard.acceptedTypes")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("projects.wizard.maxSize")}
              </p>
            </div>
          )}
        </div>

        {/* Uploaded files list */}
        {documents.length > 0 ? (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">
              Uploaded Files ({documents.length})
            </h5>
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card key={doc.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(doc.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(doc.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(doc.id)}
                      title={t("projects.wizard.removeFile")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-4">
            {t("projects.wizard.noDocuments")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t("projects.wizard.back")}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("projects.wizard.cancel")}
          </Button>
          <Button onClick={onNext} disabled={uploading}>
            {t("projects.wizard.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
