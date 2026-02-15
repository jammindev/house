// nextjs/src/features/interactions/components/gallery/ImageGallery.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getInteractionFileName } from "@interactions/utils/getInteractionFileName";
import type { Document } from "@interactions/types";
import type { FilePreview } from "@interactions/hooks/useSignedFilePreviews";

import GalleryGrid from "./GalleryGrid";
import GalleryModal from "./GalleryModal";
import type { GalleryItem } from "./types";

interface ImageGalleryProps {
    files: Document[];
    previews: Record<string, FilePreview>;
    onDeleted?: () => void;
}

export default function ImageGallery({ files, previews, onDeleted }: ImageGalleryProps) {
    const galleryItems: GalleryItem[] = useMemo(() => {
        return files
            .map((file): GalleryItem | null => {
                const preview = previews[file.id];
                const viewUrl = preview?.view;
                if (!viewUrl) return null;
                return {
                    file,
                    viewUrl,
                    thumbnailUrl: preview?.thumbnail ?? viewUrl,
                    fileName: getInteractionFileName(file),
                };
            })
            .filter((item): item is GalleryItem => item !== null);
    }, [files, previews]);

    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const showNext = useCallback(() => {
        setActiveIndex((i) =>
            i === null ? null : (i + 1) % galleryItems.length
        );
    }, [galleryItems.length]);

    const showPrevious = useCallback(() => {
        setActiveIndex((i) =>
            i === null ? null : (i - 1 + galleryItems.length) % galleryItems.length
        );
    }, [galleryItems.length]);

    const closeModal = useCallback(() => setActiveIndex(null), []);

    useEffect(() => {
        if (activeIndex === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") showNext();
            if (e.key === "ArrowLeft") showPrevious();
            if (e.key === "Escape") closeModal();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeIndex, closeModal, showNext, showPrevious]);

    if (!galleryItems.length) return null;

    return (
        <div>
            <GalleryGrid items={galleryItems} onSelect={setActiveIndex} />

            {activeIndex !== null && (
                <GalleryModal
                    item={galleryItems[activeIndex]}
                    onClose={closeModal}
                    onNext={showNext}
                    onPrevious={showPrevious}
                    hasMultiple={galleryItems.length > 1}
                    downloadUrl={previews[galleryItems[activeIndex].file.id]?.download}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    );
}
