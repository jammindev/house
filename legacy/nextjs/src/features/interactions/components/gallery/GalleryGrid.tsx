// nextjs/src/features/interactions/components/gallery/GalleryGrid.tsx
import type { GalleryItem } from "./types";
import GalleryThumbnail from "./GalleryThumbnail";

interface GalleryGridProps {
    items: GalleryItem[];
    onSelect: (index: number) => void;
}

export default function GalleryGrid({ items, onSelect }: GalleryGridProps) {
    return (
        <div  className="grid grid-cols-3 gap-[2px] sm:gap-1">
            {items.map((item, index) => (
                <GalleryThumbnail
                    key={item.file.id}
                    item={item}
                    onClick={() => onSelect(index)}
                />
            ))}
        </div>
    );
}