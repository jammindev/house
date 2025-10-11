interface GalleryThumbnailProps {
    item: { file: any; url: string; fileName: string };
    onClick: () => void;
}

export default function GalleryThumbnail({ item, onClick }: GalleryThumbnailProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="aspect-square w-full rounded-md overflow-hidden border border-gray-200 bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white group"
        >
            <img
                src={item.url}
                alt={item.fileName}
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
        </button>
    );
}
