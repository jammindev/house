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
            <CardHeader className={isMobile ? "px-3 py-4" : undefined}>
                <div className={`flex items-start justify-between ${isMobile ? "gap-2" : "gap-4"}`}>
                    <div className="min-w-0 flex-1">
                        <CardTitle className={`${isMobile ? "text-base" : "text-lg"} truncate`}>
                            {t("storage.uploadCardTitle")}
                        </CardTitle>
                        <CardDescription className={`${isMobile ? "text-xs" : ""} mt-1`}>
                            {t("storage.uploadCardSubtitle")}
                        </CardDescription>
                    </div>
                    {/* Desktop-only collapse toggle */}
                    {!isMobile && <div className="md:flex items-center flex-shrink-0">
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
                <CardContent className={`${isMobile ? "px-3 pb-4 space-y-3" : "space-y-4"}`}>
                    {/* Adaptive upload interface */}
                    {isMobile ? (
                        <MobileUploadInterface
                            onFilesSelected={handleFilesSelected}
                            onScannerOpen={() => setScannerOpen(true)}
                            disabled={globalLoading}
                        />
                    ) : (
                        <DesktopUploadInterface
                            onFilesSelected={handleFilesSelected}
                            disabled={globalLoading}
                        />
                    )}

                    {error && (
                        <Alert variant="destructive" className={isMobile ? "text-sm" : undefined}>
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            <AlertDescription className={isMobile ? "text-xs" : undefined}>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className={`border-green-200 bg-green-50 text-green-800 ${isMobile ? "text-sm" : ""}`}>
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            <AlertDescription className={isMobile ? "text-xs" : undefined}>{success}</AlertDescription>
                        </Alert>
                    )}

                    {stagedFiles.length === 0 ? (
                        <p className={`text-gray-500 ${isMobile ? "text-xs px-1" : "text-sm"}`}>
                            {t("storage.stageEmpty")}
                        </p>
                    ) : (
                        <div className={isMobile ? "space-y-3" : "space-y-4"}>
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

                    <div className={`flex items-center border-t pt-4 ${isMobile ? "justify-center pt-3" : "justify-end"}`}>
                        <Button
                            type="button"
                            onClick={() => void handleUpload()}
                            disabled={uploadDisabled}
                            className={isMobile ? "w-full text-sm" : "min-w-[10rem]"}
                            size={isMobile ? "default" : undefined}
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
