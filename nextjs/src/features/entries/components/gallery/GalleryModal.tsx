"use client";

import {
    Dialog,
    DialogContent,
    DialogOverlay,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X, Download, Trash2 } from "lucide-react";
import { formatFileSize, getEntryFileSize } from "@entries/utils/formatFileSize";
import type { GalleryItem } from "./types";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteEntryFile } from "@entries/hooks/useDeleteEntryFile";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface GalleryModalProps {
    item: GalleryItem | null;
    onClose: () => void;
    onNext: () => void;
    onPrevious: () => void;
    hasMultiple: boolean;
    downloadUrl?: string;
    onDeleted?: () => void;
}

export default function GalleryModal({
    item,
    onClose,
    onNext,
    onPrevious,
    hasMultiple,
    downloadUrl,
    onDeleted,
}: GalleryModalProps) {
    const isOpen = !!item;
    const { t } = useI18n();
    const { user } = useGlobal();
    const canDelete = useMemo(() => !!(item?.file?.created_by && user?.id && item.file.created_by === user.id), [item?.file?.created_by, user?.id]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { deleteFile, loading } = useDeleteEntryFile();

    const fileSizeLabel = item ? formatFileSize(getEntryFileSize(item.file)) : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogOverlay className="bg-black/80" />

            <DialogContent hideDefaultCloseButton className="border-none bg-transparent shadow-none p-0">
                <VisuallyHidden>
                    <DialogTitle>
                        Image agrandie : {item?.fileName}
                        {fileSizeLabel ? ` (${fileSizeLabel})` : ""}
                    </DialogTitle>
                </VisuallyHidden>

                {item && (
                    <div className="relative flex items-center justify-center">
                        {/* === Bouton Fermer === */}
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={onClose}
                            className="absolute top-3 right-5"
                            aria-label="Fermer"
                        >
                            <X className="w-5 h-5 text-gray-900" />
                        </Button>

                        {/* === Bouton Télécharger === */}
                        {downloadUrl && (
                            <Button
                                asChild
                                size="icon"
                                variant="ghost"
                                className="absolute top-3 left-5"
                                aria-label={`Télécharger ${item.fileName}`}
                            >
                                <a href={downloadUrl}>
                                    <Download className="w-5 h-5 text-gray-900" />
                                </a>
                            </Button>
                        )}

                        {/* === Bouton Supprimer (si propriétaire) === */}
                        {canDelete && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute top-3 left-16 text-red-600"
                                    onClick={() => setConfirmOpen(true)}
                                    aria-label={`Supprimer ${item.fileName}`}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                                <ConfirmDialog
                                    open={confirmOpen}
                                    onOpenChange={setConfirmOpen}
                                    title={t("entries.deleteFileTitle")}
                                    confirmText={t("common.delete")}
                                    destructive
                                    loading={loading}
                                    onConfirm={async () => {
                                        if (!item) return;
                                        await deleteFile({ id: item.file.id, storage_path: item.file.storage_path });
                                        setConfirmOpen(false);
                                        onDeleted?.();
                                        onClose();
                                    }}
                                />
                            </>
                        )}

                        {/* === Navigation gauche/droite === */}
                        {hasMultiple && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute left-5 top-1/2 -translate-y-1/2"
                                    onClick={onPrevious}
                                    aria-label="Image précédente"
                                >
                                    <ArrowLeft className="w-5 h-5 text-gray-900" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-5 top-1/2 -translate-y-1/2"
                                    onClick={onNext}
                                    aria-label="Image suivante"
                                >
                                    <ArrowRight className="w-5 h-5 text-gray-900" />
                                </Button>
                            </>
                        )}

                        {/* === Image === */}
                        <figure className="max-h-[calc(100vh-6rem)] w-full max-w-4xl">
                            <img
                                src={item.url}
                                alt={item.fileName}
                                className="h-full w-full max-h-[calc(100vh-6rem)] object-contain"
                            />
                            {item.fileName && (
                                <figcaption className="mt-3 text-center text-sm text-gray-200">
                                    {item.fileName}
                                    {fileSizeLabel && (
                                        <span className="ml-2 text-xs text-gray-300">{fileSizeLabel}</span>
                                    )}
                                </figcaption>
                            )}
                        </figure>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
