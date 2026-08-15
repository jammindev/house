import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { type ZoneLabel } from '@/lib/api/zones';
import { useZonePrintSheet } from './hooks';

/**
 * La planche d'étiquettes QR du foyer — une par pièce, à imprimer et à coller.
 *
 * Les QR sont des SVG **rendus par le serveur** (`segno`) : pas de bibliothèque
 * de génération côté client pour un écran qu'un foyer ouvre une fois dans sa
 * vie. Voir `docs/fiches/ANCRAGE_PHYSIQUE.md`.
 */
export default function ZoneQrPrintPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useZonePrintSheet();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const labels: ZoneLabel[] = data?.labels ?? [];

  return (
    <div>
      <div className="print:hidden">
        <BackLink fallback="/app/zones" fallbackLabel={t('zones.title')} />
        <PageHeader title={t('zones.qr.printTitle')}>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" aria-hidden />
            {t('zones.qr.printButton')}
          </Button>
        </PageHeader>
        <p className="pb-4 text-sm text-muted-foreground">{t('zones.qr.printIntro')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
        {labels.map((label) => (
          <Card
            key={label.zone_id}
            className="flex flex-col items-center gap-2 p-4 text-center print:break-inside-avoid print:border print:border-border"
          >
            {/*
              `dangerouslySetInnerHTML` est ici sans risque et c'est **vérifiable** :
              le SVG est produit par `segno` à partir de la seule URL d'étiquette,
              qui ne contient qu'un jeton alphanumérique. Aucun texte du foyer n'y
              entre — le nom de la pièce est rendu comme texte, juste en dessous.
            */}
            <div
              className="w-full max-w-[160px] [&>svg]:h-auto [&>svg]:w-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: label.svg }}
            />
            <span className="text-sm font-medium text-foreground">{label.name}</span>
            {label.full_path !== label.name && (
              <span className="text-xs text-muted-foreground print:hidden">
                {label.full_path}
              </span>
            )}
          </Card>
        ))}
      </div>

      {labels.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('zones.qr.printEmpty')}
        </p>
      )}
    </div>
  );
}
