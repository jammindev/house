// nextjs/src/features/documents/components/DocumentUploadSection.tsx
"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ChevronUp, Plus, Camera } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useDocumentUpload } from "../hooks/useDocumentUpload";
import { useIsMobile } from "../hooks/useIsMobile";
import { DOCUMENT_TYPES } from "../utils/uploadHelpers";
import { CameraScannerDialog } from "./CameraScannerDialog";
import { DesktopUploadInterface } from "./DesktopUploadInterface";
import { MobileUploadInterface } from "./MobileUploadInterface";
import { StagedFileItem } from "./StagedFileItem";

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
    const [scannerOpen, setScannerOpen] = useState(false);

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

    const handleScannerComplete = (file: File) => {
        stageFiles([file]);
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

                    <div className="rounded-lg border border-dashed border-slate-200/80 bg-slate-50/80 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-700">
                                    {t("storage.cameraScanner.action")}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {t("storage.cameraScanner.helper")}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size={isMobile ? "lg" : "sm"}
                                className={isMobile ? "w-full" : undefined}
                                onClick={() => setScannerOpen(true)}
                            >
                                <span className="flex items-center gap-2">
                                    <Camera className="h-4 w-4" aria-hidden="true" />
                                    {t("storage.cameraScanner.action")}
                                </span>
                            </Button>
                        </div>
                    </div>

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
            <CameraScannerDialog
                open={scannerOpen}
                onOpenChange={setScannerOpen}
                onComplete={handleScannerComplete}
            />
        </Card>
    );
}
