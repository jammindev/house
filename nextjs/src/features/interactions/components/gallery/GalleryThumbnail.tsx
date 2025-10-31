import Image from "next/image";
import type { GalleryItem } from "./types";

interface GalleryThumbnailProps {
  item: GalleryItem;
  onClick: () => void;
}

export default function GalleryThumbnail({ item, onClick }: GalleryThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group aspect-square w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <Image
        src={item.thumbnailUrl}
        alt={item.fileName}
        width={400}
        height={400}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </button>
  );
}
