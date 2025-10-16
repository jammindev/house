import type { GalleryItem } from "./types";
import GalleryThumbnail from "./GalleryThumbnail";

interface GalleryGridProps {
    items: GalleryItem[];
    onSelect: (index: number) => void;
}

export default function GalleryGrid({ items, onSelect }: GalleryGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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