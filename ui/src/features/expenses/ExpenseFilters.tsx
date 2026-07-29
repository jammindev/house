import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import PeriodPicker from './PeriodPicker';
import type { PeriodRange } from './period';

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

  return (
    <div className="space-y-3">
      <PeriodPicker period={period} onChange={onPeriodChange} idPrefix="expenses" />

      {kindOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={kind === ''} onClick={() => onKindChange('')}>
            {t('expenses.filters.allKinds')}
          </FilterPill>
          {kindOptions.map((value) => (
            <FilterPill key={value} active={kind === value} onClick={() => onKindChange(value)}>
              {t(`expenses.kind.${value}`)}
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
