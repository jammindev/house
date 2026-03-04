import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ZonePhoto } from '../types/zones';

type Props = {
  photo: ZonePhoto;
};

export default function GalleryPhoto({ photo }: Props) {
  const { t } = useTranslation();

  return (
    <li className="rounded-md border border-border bg-background p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{photo.document_name || photo.document}</p>
          {photo.note ? <p className="text-muted-foreground">{photo.note}</p> : null}
        </div>
        {photo.document_file_path ? (
          <a
            href={`/media/${photo.document_file_path}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {t('zones.photos.openPhoto')}
          </a>
        ) : null}
      </div>
    </li>
  );
}
