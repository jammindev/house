import { useMemo } from 'react';
import { Layers, NotebookText, Ruler } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ZoneDetail } from '../types/zones';

type Props = {
  zone: ZoneDetail;
  childrenCount: number;
  photosCount: number;
};

export default function ZoneDetailView({ zone, childrenCount, photosCount }: Props) {
  const { t } = useTranslation();

  const numberFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const surface = typeof zone.surface === 'number' && !Number.isNaN(zone.surface) ? numberFormatter.format(zone.surface) : null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-colors">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: zone.color }}>
          <Layers className="h-5 w-5 text-slate-600" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('zones.detail.infoTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('zones.detail.infoSubtitle')}</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-background/60 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('zones.detail.parentLabel')}</dt>
          <dd className="mt-2 text-sm text-foreground">{zone.parent?.name ?? t('zones.noParent')}</dd>
        </div>
        <div className="rounded-xl border border-border/40 bg-background/60 p-4">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Ruler className="h-4 w-4 text-amber-600" />
            {t('zones.detail.surfaceLabel')}
          </dt>
          <dd className="mt-2 text-sm text-foreground">{surface ? t('zones.surfaceValue', { value: surface }) : t('zones.detail.surfaceMissing')}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-background/60 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('zones.detail.childrenLabel')}</dt>
          <dd className="mt-2 text-sm text-foreground">{childrenCount}</dd>
        </div>
        <div className="rounded-xl border border-border/40 bg-background/60 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('zones.detail.photosLabel')}</dt>
          <dd className="mt-2 text-sm text-foreground">{photosCount}</dd>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border/40 bg-background/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <NotebookText className="h-4 w-4 text-indigo-600" />
          {t('zones.detail.notesLabel')}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
          {zone.note?.trim() ? zone.note : <span className="text-muted-foreground">{t('zones.detail.noteEmpty')}</span>}
        </p>
      </div>
    </section>
  );
}
