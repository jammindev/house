// nextjs/src/features/documents/components/DocumentUploadSection.tsx
"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Trash2, ChevronDown, ChevronUp, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { DocumentType } from "@interactions/types";
import { useDocumentUpload, type StagedFile } from "../hooks/useDocumentUpload";
import { useIsMobile } from "../hooks/useIsMobile";
import { DOCUMENT_TYPES, formatFileSize } from "../utils/uploadHelpers";
import { MobileUploadInterface } from "./MobileUploadInterface";
import { DesktopUploadInterface } from "./DesktopUploadInterface";

type DocumentUploadSectionProps = {
    onUploadSuccess?: (uploadedIds: string[]) => void;
    /** If true, the desktop view is collapsed by default. Mobile remains always expanded. */
    defaultCollapsed?: boolean;
};

export function DocumentUploadSection({ onUploadSuccess, defaultCollapsed = true }: DocumentUploadSectionProps) {
    const { t } = useI18n();
    const { loading: globalLoading } = useGlobal();
    const isMobile = useIsMobile();
    // collapsed by default on desktop as requested (can be controlled via prop)
    const [isCollapsed, setIsCollapsed] = useState<boolean>(() => defaultCollapsed);

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
    } = useDocumentUpload();

    const typeOptions = [
        ...DOCUMENT_TYPES.map((value) => ({
            value,
            label: t(`storage.type.${value}` as const),
        })),
    ];

    const handleFilesSelected = (files: FileList) => {
        stageFiles(files);
    };

    const handleUpload = async () => {
        try {
            const uploadedIds = await uploadFiles();
            onUploadSuccess?.(uploadedIds);
        } catch (err) {
            // Error is already handled in the hook
        }
    };

    const stagedCount = stagedFiles.length;
    const uploadDisabled = !canUpload || globalLoading;

    const handleCardClick = () => {
        if (isMobile || !isCollapsed) return;
        setIsCollapsed(false);
    };

    return (
        <Card
            onClick={handleCardClick}
            className={!isMobile && isCollapsed ? "cursor-pointer" : undefined}
        >
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg">{t("storage.uploadCardTitle")}</CardTitle>
                        <CardDescription>{t("storage.uploadCardSubtitle")}</CardDescription>
                    </div>
                    {/* Desktop-only collapse toggle */}
                    {!isMobile && <div className="md:flex items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setIsCollapsed((prev) => !prev);
                            }}
                            aria-expanded={!isCollapsed}
                            className="text-slate-600"
                        >
                            {isCollapsed ? (
                                <Plus className="h-4 w-4" />
                            ) : (
                                <ChevronUp className="h-4 w-4" />
                            )}
                        </Button>
                    </div>}
                </div>
            </CardHeader>

            {isMobile || !isCollapsed ? (
                <CardContent className="space-y-4">
                    {/* Adaptive upload interface */}
                    {isMobile ? (
                        <MobileUploadInterface
                            onFilesSelected={handleFilesSelected}
                            disabled={globalLoading}
                        />
                    ) : (
                        <DesktopUploadInterface
                            onFilesSelected={handleFilesSelected}
                            disabled={globalLoading}
                        />
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
                        <p className="text-sm text-gray-500">{t("storage.stageEmpty")}</p>
                    ) : (
                        <div className="space-y-4">
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
            ) : null}
        </Card>
    );
}

type StagedFileItemProps = {
    staged: StagedFile;
    typeOptions: Array<{ value: DocumentType; label: string }>;
    onUpdate: (changes: Partial<Pick<StagedFile, "name" | "type">>) => void;
    onRemove: () => void;
};

function StagedFileItem({ staged, typeOptions, onUpdate, onRemove }: StagedFileItemProps) {
    const { t } = useI18n();

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-2">
                <div>
                    <label className="text-xs font-medium text-gray-600" htmlFor={`name-${staged.id}`}>
                        {t("storage.fields.nameLabel")}
                    </label>
                    <Input
                        id={`name-${staged.id}`}
                        value={staged.name}
                        onChange={(event) => onUpdate({ name: event.target.value })}
                        autoComplete="off"
                        className="mt-1"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-600" htmlFor={`type-${staged.id}`}>
                        {t("storage.fields.typeLabel")}
                    </label>
                    <select
                        id={`type-${staged.id}`}
                        value={staged.type}
                        onChange={(event) => onUpdate({ type: event.target.value as DocumentType })}
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    >
                        {typeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <p className="text-xs text-gray-500">
                    {staged.file.name} · {formatFileSize(staged.file.size)}
                </p>
            </div>
            <div className="flex items-center justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    aria-label={t("common.remove")}
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("common.remove")}
                </Button>
            </div>
        </div>
    );
}
