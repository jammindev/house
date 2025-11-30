// nextjs/src/features/documents/components/CameraScannerDialog.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t("storage.cameraScanner.title")}</DialogTitle>
                    <DialogDescription>{t("storage.cameraScanner.description")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div
                        className={cn(
                            "relative overflow-hidden rounded-xl border bg-black/80",
                            !isSupported && "bg-slate-100"
                        )}
                    >
                        {isSupported ? (
                            <>
                                <video
                                    ref={videoRef}
                                    className="h-64 w-full object-contain sm:h-80"
                                    playsInline
                                    muted
                                    autoPlay
                                />
                                <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/40 bg-black/60 px-4 py-2 text-center text-sm text-white shadow-md">
                                    {t("storage.cameraScanner.instructions")}
                                </div>
                            </>
                        ) : (
                            <div className="p-6 text-center text-sm text-slate-500">
                                {t("storage.cameraScanner.unsupported")}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            onClick={() => void handleCapture()}
                            disabled={isInitializing || isSaving || !isSupported}
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
                        <p className="text-sm text-slate-500">{pagesCountLabel}</p>
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
                </div>

                <DialogFooter className="pt-4">
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
                </DialogFooter>

                <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
            </DialogContent>
        </Dialog>
    );
}
