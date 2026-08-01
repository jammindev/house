import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { Input } from '@/design-system/input';
import { FormField } from '@/design-system/form-field';
import { formatMonthKey, todayISO } from '@/lib/format';
import { currentMonthKey, shiftMonth, type PeriodPreset, type PeriodRange } from './period';

/** Les pastilles proposées à côté du sélecteur de mois, dans l'ordre d'affichage. */
const OTHER_PRESETS: Exclude<PeriodPreset, 'month'>[] = ['last30Days', 'currentYear', 'custom'];

interface PeriodPickerProps {
  period: PeriodRange;
  onChange: (period: PeriodRange) => void;
  /** Préfixe des `id` des deux champs — deux pickers sur une page sinon collent. */
  idPrefix?: string;
  /**
   * Les presets offerts **en plus** de la navigation par mois, toujours
   * présente. `[]` réduit le sélecteur au seul stepper.
   *
   * C'est ce dont le panneau Budgets a besoin : une fenêtre libre y serait
   * comparée à un plafond **mensuel**, et « cette année » afficherait
   * 4 200 € / 400 € en rouge sur une enveloppe parfaitement tenue. Le composant
   * reste le même — seule la liste des fenêtres qui ont un sens change.
   */
  presets?: Exclude<PeriodPreset, 'month'>[];
}

/**
 * Un mois que l'on parcourt, plus quelques fenêtres usuelles.
 *
 * Extrait d'`ExpenseFilters` le jour où la fiche d'un budget a eu besoin des
 * mêmes pastilles : les dupliquer aurait suffi à ce que les deux écrans ne
 * proposent plus les mêmes périodes six mois plus tard — et « ce mois-ci » d'un
 * côté qui ne veut pas dire « ce mois-ci » de l'autre est exactement le genre
 * d'écart que le module argent paie cher.
 *
 * Les pastilles « ce mois-ci » et « mois précédent » ont laissé place au
 * stepper `◀ juillet 2026 ▶`, dont elles n'étaient que les deux premiers crans :
 * la question posée devant un plafond mensuel est « et le mois d'avant ? »,
 * répétée autant de fois qu'il faut, et deux pastilles n'y répondaient qu'une
 * fois. Le mois en cours **borne la marche avant** — au-delà il n'y a rien à
 * lire, et une flèche qui mène à des écrans vides invite à un voyage sans fond.
 *
 * Passer sur « personnalisé » pré-remplit les deux dates à aujourd'hui plutôt
 * que de les laisser vides : une fenêtre sans borne interroge tout l'historique
 * dès le premier clic, avant que l'utilisateur ait rien choisi.
 */
export default function PeriodPicker({
  period,
  onChange,
  idPrefix = 'period',
  presets = OTHER_PRESETS,
}: PeriodPickerProps) {
  const { t } = useTranslation();

  const onMonth = period.preset === 'month';
  // Le stepper reste utilisable depuis une autre fenêtre : cliquer ◀ depuis
  // « cette année » repart du mois en cours plutôt que de ne rien faire.
  const month = (onMonth ? period.month : undefined) || currentMonthKey();
  const isCurrentMonth = onMonth && month === currentMonthKey();

  function goToMonth(delta: number) {
    onChange({ preset: 'month', month: onMonth ? shiftMonth(month, delta) : month });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            aria-label={t('expenses.filters.period.previousMonth')}
            onClick={() => goToMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <FilterPill
            active={onMonth}
            onClick={() => onChange({ preset: 'month', month })}
            className="min-w-[9.5rem] justify-center capitalize"
          >
            {formatMonthKey(month)}
          </FilterPill>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            aria-label={t('expenses.filters.period.nextMonth')}
            disabled={isCurrentMonth}
            onClick={() => goToMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {presets.map((preset) => (
          <FilterPill
            key={preset}
            active={period.preset === preset}
            onClick={() =>
              onChange(
                preset === 'custom'
                  ? {
                      preset: 'custom',
                      from: period.from ?? todayISO(),
                      to: period.to ?? todayISO(),
                    }
                  : { preset },
              )
            }
          >
            {t(`expenses.filters.period.${preset}`)}
          </FilterPill>
        ))}
      </div>

      {period.preset === 'custom' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t('expenses.filters.from')} htmlFor={`${idPrefix}-from`}>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              value={period.from ?? ''}
              onChange={(e) =>
                onChange({ preset: 'custom', from: e.target.value || undefined, to: period.to })
              }
            />
          </FormField>
          <FormField label={t('expenses.filters.to')} htmlFor={`${idPrefix}-to`}>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              value={period.to ?? ''}
              onChange={(e) =>
                onChange({ preset: 'custom', from: period.from, to: e.target.value || undefined })
              }
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
