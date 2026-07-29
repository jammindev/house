import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import { Input } from '@/design-system/input';
import { FormField } from '@/design-system/form-field';
import { todayISO } from '@/lib/format';
import type { PeriodPreset, PeriodRange } from './period';

const PRESETS: PeriodPreset[] = [
  'currentMonth',
  'previousMonth',
  'last30Days',
  'currentYear',
  'custom',
];

interface PeriodPickerProps {
  period: PeriodRange;
  onChange: (period: PeriodRange) => void;
  /** Préfixe des `id` des deux champs — deux pickers sur une page sinon collent. */
  idPrefix?: string;
}

/**
 * Les quatre périodes usuelles, plus une fenêtre libre.
 *
 * Extrait d'`ExpenseFilters` le jour où la fiche d'un budget a eu besoin des
 * mêmes pastilles : les dupliquer aurait suffi à ce que les deux écrans ne
 * proposent plus les mêmes périodes six mois plus tard — et « ce mois-ci » d'un
 * côté qui ne veut pas dire « ce mois-ci » de l'autre est exactement le genre
 * d'écart que le module argent paie cher.
 *
 * Passer sur « personnalisé » pré-remplit les deux dates à aujourd'hui plutôt
 * que de les laisser vides : une fenêtre sans borne interroge tout l'historique
 * dès le premier clic, avant que l'utilisateur ait rien choisi.
 */
export default function PeriodPicker({ period, onChange, idPrefix = 'period' }: PeriodPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
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
