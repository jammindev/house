// nextjs/src/features/documents/components/CameraScannerDialog.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

type CameraScannerDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: (file: File) => void;
};

type CapturedPage = {
    id: string;
    blob: Blob;
    url: string;
};

const isMediaDevicesSupported = () =>
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

const createId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `page_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function CameraScannerDialog({ open, onOpenChange, onComplete }: CameraScannerDialogProps) {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [pages, setPages] = useState<CapturedPage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSupported, setIsSupported] = useState(true);

    const releaseStream = useCallback(() => {
        const stream = streamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const clearPages = useCallback(() => {
        setPages((prev) => {
            prev.forEach((page) => URL.revokeObjectURL(page.url));
            return [];
        });
    }, []);

    const startCamera = useCallback(async () => {
        if (!isMediaDevicesSupported()) {
            setIsSupported(false);
            setError(t("storage.cameraScanner.unsupported"));
            return;
        }

        setIsSupported(true);
        setIsInitializing(true);
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => undefined);
            }
        } catch (err) {
            console.error(err);
            setError(t("storage.cameraScanner.cameraError"));
        } finally {
            setIsInitializing(false);
        }
    }, [t]);

    useEffect(() => {
        if (open) {
            void startCamera();
        } else {
            releaseStream();
            clearPages();
            setError(null);
        }

        return () => {
            releaseStream();
        };
    }, [open, startCamera, releaseStream, clearPages]);

    const handleCapture = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
            setError(t("storage.cameraScanner.captureError"));
            return;
        }

        context.filter = "brightness(1.05) contrast(1.2) saturate(1.05)";
        context.drawImage(video, 0, 0, width, height);

        const blob: Blob | null = await new Promise((resolve) =>
            canvas.toBlob((result) => resolve(result), "image/jpeg", 0.95)
        );

        if (!blob) {
            setError(t("storage.cameraScanner.captureError"));
            return;
        }

        const url = URL.createObjectURL(blob);
        setPages((prev) => [...prev, { id: createId(), blob, url }]);
        setError(null);
    }, [t]);

    const handleRemovePage = useCallback((id: string) => {
        setPages((prev) => {
            const target = prev.find((page) => page.id === id);
            if (target) {
                URL.revokeObjectURL(target.url);
            }
            return prev.filter((page) => page.id !== id);
        });
    }, []);

    const createPdfFromPages = useCallback(async () => {
        const pdfDoc = await PDFDocument.create();

        for (const captured of pages) {
            const bytes = await captured.blob.arrayBuffer();
            const extension = captured.blob.type === "image/png" ? "png" : "jpg";
            const embedded =
                extension === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            const page = pdfDoc.addPage([embedded.width, embedded.height]);
            page.drawImage(embedded, {
                x: 0,
                y: 0,
                width: embedded.width,
                height: embedded.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const filename = `scan-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
        return new File([pdfBytes], filename, { type: "application/pdf" });
    }, [pages]);

    const handleSave = useCallback(async () => {
        if (!pages.length) return;
        setIsSaving(true);
        setError(null);

        try {
            const pdfFile = await createPdfFromPages();
            onComplete(pdfFile);
            onOpenChange(false);
            clearPages();
        } catch (err) {
            console.error(err);
            setError(t("storage.cameraScanner.saveError"));
        } finally {
            setIsSaving(false);
        }
    }, [pages.length, createPdfFromPages, onComplete, onOpenChange, clearPages, t]);

    const resetScanner = useCallback(() => {
        clearPages();
        setError(null);
    }, [clearPages]);

    const pagesCountLabel = useMemo(() => {
        if (!pages.length) return t("storage.cameraScanner.emptyState");
        return t("storage.cameraScanner.pagesCount", { count: pages.length });
    }, [pages.length, t]);

    return (
        <SheetDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t("storage.cameraScanner.title")}
            description={t("storage.cameraScanner.description")}
            contentClassName="p-0 gap-0"
            containerClassName="max-h-[95vh]"
            trigger={<div style={{ display: 'none' }} />} // Hidden trigger as it's controlled
        >
            <div className="flex flex-col h-full min-h-0">
                {/* Camera Section - Takes most of the space */}
                <div className="relative flex-1 min-h-[60vh]">
                    {isSupported ? (
                        <>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover rounded-lg"
                                playsInline
                                muted
                                autoPlay
                            />
                            <div className="absolute top-4 left-4 right-4 rounded-lg border border-white/40 bg-black/60 px-4 py-2 text-center text-sm text-white shadow-md">
                                <p className="text-xs text-white/90">{t("storage.cameraScanner.instructions")}</p>
                            </div>

                            {/* Capture Button - Fixed position */}
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                                <Button
                                    type="button"
                                    onClick={() => void handleCapture()}
                                    disabled={isInitializing || isSaving || !isSupported}
                                    size="lg"
                                    className="rounded-full w-16 h-16 bg-white text-black hover:bg-gray-100 shadow-lg"
                                >
                                    {isInitializing ? (
                                        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Camera className="h-8 w-8" aria-hidden="true" />
                                    )}
                                </Button>
                            </div>

                            {/* Pages count indicator */}
                            {pages.length > 0 && (
                                <div className="absolute bottom-6 right-4 rounded-lg bg-black/60 px-3 py-2 text-sm text-white">
                                    {pagesCountLabel}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-slate-100 rounded-lg">
                            <div className="text-center">
                                <Camera className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                                <p className="text-sm text-slate-500">{t("storage.cameraScanner.unsupported")}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Scrollable Content Section */}
                <div className="flex-shrink-0 mt-4 space-y-4 max-h-[35vh] overflow-y-auto">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            onClick={() => void handleCapture()}
                            disabled={isInitializing || isSaving || !isSupported}
                            variant="outline"
                        >
                            {isInitializing ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    {t("storage.cameraScanner.initializing")}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Camera className="h-4 w-4" aria-hidden="true" />
                                    {t("storage.cameraScanner.capture")}
                                </span>
                            )}
                        </Button>
                        {pages.length > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={resetScanner}
                                disabled={isSaving}
                            >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                {t("storage.cameraScanner.reset")}
                            </Button>
                        )}
                    </div>

                    {pages.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {pages.map((page, index) => (
                                <div key={page.id} className="relative rounded-lg border">
                                    <img
                                        src={page.url}
                                        alt={t("storage.cameraScanner.pagePreview", { index: index + 1 })}
                                        className="h-32 w-full rounded-t-lg object-cover"
                                    />
                                    <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-600">
                                        <span>{t("storage.cameraScanner.pageLabel", { index: index + 1 })}</span>
                                        <button
                                            type="button"
                                            className="text-slate-500 transition hover:text-red-600"
                                            onClick={() => handleRemovePage(page.id)}
                                        >
                                            {t("storage.cameraScanner.deletePage")}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer with actions */}
                    <div className="flex justify-between gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            {t("storage.cameraScanner.cancel")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={!pages.length || isSaving}
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    {t("storage.cameraScanner.saving")}
                                </span>
                            ) : (
                                t("storage.cameraScanner.save")
                            )}
                        </Button>
                    </div>
                </div>

                <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
            </div>
        </SheetDialog>
    );
}
