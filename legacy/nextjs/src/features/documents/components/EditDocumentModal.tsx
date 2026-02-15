// nextjs/src/features/documents/components/EditDocumentModal.tsx
"use client";

import React, { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MobileOptimizedInput,
  MobileOptimizedTextarea,
  MobileOptimizedButton,
  MobileOptimizedSelect,
  MobileButtonGroup
} from "@/components/ui/mobile-optimized";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { DocumentType } from "@interactions/types";
import type { DocumentWithLinks } from "@documents/types";
import { useEditDocument } from "@documents/hooks/useEditDocument";

type EditDocumentModalProps = {
  document: DocumentWithLinks | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const DOCUMENT_TYPES: DocumentType[] = ["document", "photo", "quote", "invoice", "contract", "other"];

export function EditDocumentModal({ document, isOpen, onClose, onSuccess }: EditDocumentModalProps) {
  const { t } = useI18n();
  const { editDocument, isLoading } = useEditDocument();

  const [formData, setFormData] = useState({
    name: document?.name || "",
    notes: document?.notes || "",
    type: document?.type || "document" as DocumentType,
  });

  const [error, setError] = useState<string | null>(null);

  // Update form data when document changes
  React.useEffect(() => {
    if (document) {
      setFormData({
        name: document.name || "",
        notes: document.notes || "",
        type: document.type || "document",
      });
    }
  }, [document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setError(null);

    try {
      await editDocument({
        id: document.id,
        data: formData,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to edit document:", err);
      setError(t("documents.editFailed"));
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("documents.editModalTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="document-name">
              {t("documents.fieldName")}
            </label>
            <MobileOptimizedInput
              id="document-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t("documents.fieldNamePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="document-type">
              {t("documents.fieldType")}
            </label>
            <MobileOptimizedSelect
              id="document-type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as DocumentType }))}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`storage.type.${type}` as const)}
                </option>
              ))}
            </MobileOptimizedSelect>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="document-notes">
              {t("documents.fieldNotes")}
            </label>
            <MobileOptimizedTextarea
              id="document-notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t("documents.fieldNotesPlaceholder")}
              rows={3}
            />
          </div>

          <MobileButtonGroup>
            <MobileOptimizedButton
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t("documents.editModalCancel")}
            </MobileOptimizedButton>
            <MobileOptimizedButton
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t("documents.editing") : t("documents.editModalSave")}
            </MobileOptimizedButton>
          </MobileButtonGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}