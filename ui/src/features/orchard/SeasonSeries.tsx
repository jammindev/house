import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import type { HarvestSeries } from '@/lib/api/orchard';
import { formatTotals } from './format';

/**
 * Ce qu'un sujet a donné, saison après saison.
 *
 * Deux règles portent tout l'écran :
 * - **on n'additionne jamais deux unités** — 12 kg et 40 pièces se lisent côte à
 *   côte, jamais fondus en un total qui ne veut rien dire ;
 * - **une seule saison n'est pas une comparaison** — un fruitier alterne, donc
 *   l'écran le dit au lieu de laisser croire à une tendance.
 */

interface Props {
  series: HarvestSeries | undefined;
  title: string;
}

export default function SeasonSeries({ series, title }: Props) {
  const { t } = useTranslation();
  const unitLabel = (unit: string) => t(`orchard.unit.${unit}`);

  const seasons = series?.seasons ?? [];

  if (!seasons.length) {
    return (
      <Card className="p-4">
        <CardTitle>{title}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">{t('orchard.series.empty')}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <CardTitle>{title}</CardTitle>
      <ul className="mt-3 space-y-2">
        {seasons.map((season) => (
          <li key={season.season} className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium text-foreground">
              {season.season}
              {season.season === series?.current_season ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('orchard.series.currentSeason')}
                </span>
              ) : null}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatTotals(season.totals, unitLabel)}
            </span>
          </li>
        ))}
      </ul>
      {seasons.length === 1 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('orchard.series.singleSeason')}</p>
      ) : null}
    </Card>
  );
}
