import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import { Input } from '@/design-system/input';
import { FormField } from '@/design-system/form-field';
import type { PeriodPreset, PeriodRange } from './period';

const PRESETS: PeriodPreset[] = ['currentMonth', 'previousMonth', 'last30Days', 'currentYear', 'custom'];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ExpenseFiltersProps {
  period: PeriodRange;
  onPeriodChange: (period: PeriodRange) => void;
  supplier: string;
  onSupplierChange: (supplier: string) => void;
  kind: string;
  onKindChange: (kind: string) => void;
  /** Distinct supplier values from the current summary (for chips). */
  supplierOptions: string[];
  /** Distinct kind values from the current summary (for chips). */
  kindOptions: string[];
}

export default function ExpenseFilters({
  period,
  onPeriodChange,
  supplier,
  onSupplierChange,
  kind,
  onKindChange,
  supplierOptions,
  kindOptions,
}: ExpenseFiltersProps) {
  const { t } = useTranslation();

  const handleCustomFrom = (value: string) => {
    onPeriodChange({ preset: 'custom', from: value || undefined, to: period.to });
  };
  const handleCustomTo = (value: string) => {
    onPeriodChange({ preset: 'custom', from: period.from, to: value || undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <FilterPill
            key={preset}
            active={period.preset === preset}
            onClick={() => {
              if (preset === 'custom') {
                onPeriodChange({ preset: 'custom', from: period.from ?? todayIsoDate(), to: period.to ?? todayIsoDate() });
              } else {
                onPeriodChange({ preset });
              }
            }}
          >
            {t(`expenses.filters.period.${preset}`)}
          </FilterPill>
        ))}
      </div>

      {period.preset === 'custom' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t('expenses.filters.from')} htmlFor="expenses-from">
            <Input
              id="expenses-from"
              type="date"
              value={period.from ?? ''}
              onChange={(e) => handleCustomFrom(e.target.value)}
            />
          </FormField>
          <FormField label={t('expenses.filters.to')} htmlFor="expenses-to">
            <Input
              id="expenses-to"
              type="date"
              value={period.to ?? ''}
              onChange={(e) => handleCustomTo(e.target.value)}
            />
          </FormField>
        </div>
      ) : null}

      {kindOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={kind === ''} onClick={() => onKindChange('')}>
            {t('expenses.filters.allKinds')}
          </FilterPill>
          {kindOptions.map((value) => (
            <FilterPill key={value} active={kind === value} onClick={() => onKindChange(value)}>
              {t(`expenses.kind.${value}`, { defaultValue: value })}
            </FilterPill>
          ))}
        </div>
      ) : null}

      {supplierOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={supplier === ''} onClick={() => onSupplierChange('')}>
            {t('expenses.filters.allSuppliers')}
          </FilterPill>
          {supplierOptions.map((value) => (
            <FilterPill key={value} active={supplier === value} onClick={() => onSupplierChange(value)}>
              {value}
            </FilterPill>
          ))}
        </div>
      ) : null}
    </div>
  );
}
