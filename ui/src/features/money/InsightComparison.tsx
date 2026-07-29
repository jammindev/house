import { useTranslation } from 'react-i18next';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { BudgetInsights } from '@/lib/api/budget';
import { formatAmount } from '@/lib/format';

/**
 * « −12 % par rapport à juin 2026 (170 €) ».
 *
 * La période de référence a la **même forme** que celle affichée — un mois se
 * compare au mois d'avant, pas aux trente-et-un jours d'avant — et c'est le
 * serveur qui la choisit, pour que la phrase et le chiffre ne puissent pas
 * dériver l'un de l'autre.
 *
 * Sans dépense avant, il n'y a pas de pourcentage : on le dit avec des mots.
 * « +∞ % » serait le même mensonge qu'une part sur un total nul.
 *
 * Partagé entre la fiche d'une enveloppe et celle d'une catégorie : les deux
 * lisent le **même** payload `insights`, donc la phrase doit être la même. Un
 * second exemplaire aurait fini par arrondir autrement ou nommer autrement la
 * période, et deux écrans qui comparent le même mois avec deux voix ne
 * s'accordent plus jamais.
 */
export default function InsightComparison({
  insights,
  locale,
}: {
  insights: BudgetInsights;
  locale: string;
}) {
  const { t } = useTranslation();
  const { delta, previous, previous_period: window } = insights;
  const ratio = delta.ratio;
  const label = window.from ? rangeLabel(window.from, window.to, locale) : '';

  if (ratio === null) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {t('budgetDetail.compare.noBaseline', { period: label })}
      </p>
    );
  }

  const up = ratio > 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-flex items-center gap-1 font-medium tabular-nums ${
          up ? 'text-destructive' : 'text-primary'
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {up ? '+' : ''}
        {Math.round(ratio * 100)}%
      </span>
      <span>
        {t('budgetDetail.compare.versus', {
          period: label,
          amount: formatAmount(previous.net_total, { fractionDigits: 0 }),
        })}
      </span>
    </p>
  );
}

/** « juin 2026 » pour un mois plein, « 1 – 10 juil. » sinon. */
function rangeLabel(from: string, to: string | null, locale: string): string {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to ?? from}T12:00:00`);
  const isFullMonth =
    start.getDate() === 1 &&
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear() &&
    new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() === end.getDate();

  if (isFullMonth) {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(start);
  }
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return `${format.format(start)} – ${format.format(end)}`;
}
