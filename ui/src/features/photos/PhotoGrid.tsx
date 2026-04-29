import { Camera } from 'lucide-react';
import type { DocumentItem } from '@/lib/api/documents';

interface PhotoGridProps {
  photos: DocumentItem[];
  onPhotoClick: (photo: DocumentItem) => void;
}

export default function PhotoGrid({ photos, onPhotoClick }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          className="group relative aspect-square overflow-hidden rounded-md bg-slate-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => onPhotoClick(photo)}
          aria-label={photo.name}
        >
          {photo.thumbnail_url || photo.file_url ? (
            <img
              src={photo.thumbnail_url || photo.file_url || ''}
              alt={photo.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <Camera className="h-6 w-6" aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 truncate">
            {photo.name}
          </div>
        </button>
      ))}
    </div>
  );
}
