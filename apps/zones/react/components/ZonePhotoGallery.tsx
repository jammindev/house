import { type FormEvent, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHouseholdId } from '@/lib/useHouseholdId';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { useToast } from '@/lib/toast';

import type { ZonePhoto } from '../types/zones';
import GalleryPhoto from './GalleryPhoto';

type Props = {
  photos: ZonePhoto[];
  loading?: boolean;
  onAttachPhoto: (documentId: string, note?: string) => Promise<void>;
};

export default function ZonePhotoGallery({ photos, loading = false, onAttachPhoto }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [documentId, setDocumentId] = useState('');
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);

  const canManage = Boolean(useHouseholdId());

  async function handleAttach(event: FormEvent) {
    event.preventDefault();
    const trimmed = documentId.trim();
    if (!trimmed) return;

    setWorking(true);
    try {
      await onAttachPhoto(trimmed, note.trim());
      setDocumentId('');
      setNote('');
      toast({ title: t('zones.photos.linkSuccess'), variant: 'success' });
    } catch (error) {
      toast({
        title: t('zones.photos.linkFailed'),
        description: error instanceof Error ? error.message : t('zones.photos.linkFailed'),
        variant: 'destructive',
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">{t('zones.photos.title')}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{t('zones.photos.helper')}</p>

      {canManage ? (
        <form onSubmit={handleAttach} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            placeholder={t('zones.photos.documentIdPlaceholder')}
          />
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('zones.notePlaceholder')} />
          <Button type="submit" disabled={working || !documentId.trim()}>
            {working ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('zones.saveInProgress')}
              </span>
            ) : (
              t('zones.photos.linkExisting')
            )}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('zones.loading')}</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('zones.photos.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {photos.map((photo) => (
            <GalleryPhoto key={`${photo.zone}-${photo.document}`} photo={photo} />
          ))}
        </ul>
      )}
    </section>
  );
}
