// nextjs/src/features/interactions/components/forms/common/DocumentsFields.tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import AddDocumentsModal, { type StagedDocument } from "@documents/components/AddDocumentModal";
import ExistingDocumentsModal from "@interactions/components/ExistingDocumentsModal";
import SelectedFileItem from "@interactions/components/SelectedFileItem";
import type { Document, DocumentType } from "@interactions/types";

export type LocalFile = {
    file: File;
    customName: string;
    type: DocumentType;
    notes?: string;
};

export interface DocumentsFieldsProps {
    files: LocalFile[];
    onFilesChange: (files: LocalFile[]) => void;
    libraryDocuments: Document[];
    onLibraryDocumentsChange: (docs: Document[]) => void;
    householdId: string | null;
}

export default function DocumentsFields({
    files,
    onFilesChange,
    libraryDocuments,
    onLibraryDocumentsChange,
    householdId,
}: DocumentsFieldsProps) {
    const { t } = useI18n();
    const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
    const [libraryModalOpen, setLibraryModalOpen] = useState(false);

    const handleDocumentsStaged = useCallback((staged: StagedDocument[]) => {
        if (staged.length === 0) return;

        onFilesChange([
            ...files,
            ...staged.map<LocalFile>((item) => ({
                file: item.file,
                customName: item.name || item.file.name,
                type: item.type,
                notes: item.notes,
            })),
        ]);
    }, [files, onFilesChange]);

    const handleFileNameChange = useCallback((index: number, value: string) => {
        onFilesChange(files.map((item, idx) => (idx === index ? { ...item, customName: value } : item)));
    }, [files, onFilesChange]);

    const handleFileTypeChange = useCallback((index: number, nextType: DocumentType) => {
        onFilesChange(files.map((item, idx) => (idx === index ? { ...item, type: nextType } : item)));
    }, [files, onFilesChange]);

    const handleRemoveFile = useCallback((index: number) => {
        onFilesChange(files.filter((_, idx) => idx !== index));
    }, [files, onFilesChange]);

    const handleLibraryConfirm = useCallback(async (docs: Document[]) => {
        if (!docs.length) return;
        const map = new Map(libraryDocuments.map((doc) => [doc.id, doc]));
        docs.forEach((doc) => map.set(doc.id, doc));
        onLibraryDocumentsChange(Array.from(map.values()));
    }, [libraryDocuments, onLibraryDocumentsChange]);

    const handleRemoveLibraryDocument = useCallback((id: string) => {
        onLibraryDocumentsChange(libraryDocuments.filter((doc) => doc.id !== id));
    }, [libraryDocuments, onLibraryDocumentsChange]);

    return (
        <>
            <Card>
                <CardHeader className="space-y-1">
                    <CardTitle className="text-lg font-semibold">{t("interactionssections.documents")}</CardTitle>
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

            <AddDocumentsModal
                open={documentsModalOpen}
                onOpenChange={setDocumentsModalOpen}
                householdId={householdId || ""}
                mode="staging"
                multiple
                onStagedChange={handleDocumentsStaged}
            />
            <ExistingDocumentsModal
                open={libraryModalOpen}
                onOpenChange={setLibraryModalOpen}
                householdId={householdId || ""}
                onConfirm={handleLibraryConfirm}
            />
        </>
    );
}