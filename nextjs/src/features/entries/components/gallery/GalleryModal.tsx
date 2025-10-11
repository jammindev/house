"use client";
import {
    Dialog,
    DialogContent,
    DialogOverlay,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { GalleryItem } from "./types";

interface GalleryModalProps {
    item: GalleryItem | null;
    onClose: () => void;
    onNext: () => void;
    onPrevious: () => void;
    hasMultiple: boolean;
}

export default function GalleryModal({
    item,
    onClose,
    onNext,
    onPrevious,
    hasMultiple,
}: GalleryModalProps) {
    const isOpen = !!item;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogOverlay className="bg-black/80" />

            <DialogContent className="border-none bg-transparent shadow-none p-0">
                <VisuallyHidden>
                    <DialogTitle>Image agrandie : {item?.fileName}</DialogTitle>
                </VisuallyHidden>

                {item && (
                    <div className="relative flex items-center justify-center">
                        {hasMultiple && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    onClick={onPrevious}
                                    aria-label="Image précédente"
                                >
                                    <ArrowLeft className="w-5 h-5 text-gray-900" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    onClick={onNext}
                                    aria-label="Image suivante"
                                >
                                    <ArrowRight className="w-5 h-5 text-gray-900" />
                                </Button>
                            </>
                        )}

                        <figure className="max-h-[calc(100vh-6rem)] w-full max-w-4xl">
                            <img
                                src={item.url}
                                alt={item.fileName}
                                className="h-full w-full max-h-[calc(100vh-6rem)] object-contain"
                            />
                            {item.fileName && (
                                <figcaption className="mt-3 text-center text-sm text-gray-200">
                                    {item.fileName}
                                </figcaption>
                            )}
                        </figure>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}