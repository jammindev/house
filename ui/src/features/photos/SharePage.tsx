import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ImageOff, Upload, X } from 'lucide-react';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useCreateDocument } from '@/features/documents/hooks';
import { takeSharedFiles } from './sharedFiles';

type Status = 'reading' | 'sending' | 'done' | 'empty';

/**
 * L'atterrissage d'un partage système Android (`share_target` du manifeste).
 *
 * Le service worker a intercepté le POST du partage et mis les fichiers de côté —
 * il ne peut pas les téléverser lui-même, faute de pouvoir lire `localStorage` où
 * vit le jeton. C'est donc ici, dans la page, que l'envoi se fait.
 *
 * L'envoi part **tout seul**, sans bouton à presser : l'utilisateur a déjà exprimé
 * son intention dans le menu de partage du système. Lui redemander confirmation
 * ferait de deux gestes ce qui devait en être un.
 */
export default function SharePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createDocument = useCreateDocument();

  const [status, setStatus] = React.useState<Status>('reading');
  const [files, setFiles] = React.useState<File[]>([]);
  const [sent, setSent] = React.useState<Set<number>>(new Set());
  const [failed, setFailed] = React.useState<Set<number>>(new Set());

  // Une ref, pas un état : le lot ne doit partir qu'une fois, même si React
  // remonte le composant (StrictMode en développement le fait systématiquement).
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      const shared = await takeSharedFiles();
      if (cancelled) return;

      if (shared.length === 0) {
        setStatus('empty');
        return;
      }

      setFiles(shared);
      setStatus('sending');

      const done = new Set<number>();
      const errors = new Set<number>();

      // Séquentiel, comme partout ailleurs : le serveur normalise l'image et
      // génère les vignettes à chaque fichier.
      for (const [index, file] of shared.entries()) {
        try {
          await createDocument.mutateAsync({ file, type: 'photo' });
          done.add(index);
          if (!cancelled) setSent(new Set(done));
        } catch {
          errors.add(index);
          if (!cancelled) setFailed(new Set(errors));
        }
      }

      if (!cancelled) setStatus('done');
    })();

    return () => {
      cancelled = true;
    };
    // createDocument est stable pour la durée de la page ; la garde `startedRef`
    // rend de toute façon l'effet non rejouable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'empty') {
    return (
      <EmptyState
        icon={ImageOff}
        title={t('photos.share.empty')}
        description={t('photos.share.empty_hint')}
        action={{ label: t('photos.title'), onClick: () => navigate('/app/photos') }}
      />
    );
  }

  const total = files.length;
  const okCount = sent.size;
  const koCount = failed.size;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('photos.share.title')}
        description={
          status === 'done'
            ? t('photos.share.finished', { count: okCount })
            : t('photos.share.progress', { current: okCount + koCount, total })
        }
      />

      <Card className="divide-y divide-border">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center justify-between gap-2 p-3 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{file.name}</span>
            {sent.has(index) ? (
              <span className="flex shrink-0 items-center gap-1 text-primary">
                <Check className="h-4 w-4" />
                {t('photos.share.sent')}
              </span>
            ) : failed.has(index) ? (
              <span className="flex shrink-0 items-center gap-1 text-destructive">
                <X className="h-4 w-4" />
                {t('photos.share.failed')}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <Upload className="h-4 w-4 animate-pulse" />
                {t('photos.share.pending')}
              </span>
            )}
          </div>
        ))}
      </Card>

      {status === 'done' ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => navigate('/app/photos')}>
            {t('photos.share.seeGallery')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
