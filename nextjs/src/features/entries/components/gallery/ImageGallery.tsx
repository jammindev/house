"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntryFile } from "@entries/types";
import type { GalleryItem } from "./types";
import GalleryGrid from "./GalleryGrid";
import GalleryModal from "./GalleryModal";

interface ImageGalleryProps {
    files: EntryFile[];
    previews: Record<string, { view: string; download: string }>;
}

export default function ImageGallery({ files, previews }: ImageGalleryProps) {
    const galleryItems: GalleryItem[] = useMemo(() => {
        return files
            .map((file): GalleryItem | null => {
                const url = previews[file.id]?.view; // 👈 correction ici
                if (!url) return null;
                return {
                    file,
                    url,
                    fileName: file.storage_path.split("/").pop() ?? "",
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
        <section>
            <h2 className="text-lg font-medium mb-3">Galerie d’images</h2>
            <GalleryGrid items={galleryItems} onSelect={setActiveIndex} />

            {activeIndex !== null && (
                <GalleryModal
                    item={galleryItems[activeIndex]}
                    onClose={closeModal}
                    onNext={showNext}
                    onPrevious={showPrevious}
                    hasMultiple={galleryItems.length > 1}
                    downloadUrl={previews[galleryItems[activeIndex].file.id]?.download}
                />
            )}
        </section>
    );
}