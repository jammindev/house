import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import PeriodPicker from './PeriodPicker';
import type { PeriodRange } from './period';

interface ExpenseFiltersProps {
  period: PeriodRange;
  onPeriodChange: (period: PeriodRange) => void;
  supplier: string;
  onSupplierChange: (supplier: string) => void;
  /**
   * « Celles auxquelles il manque un fournisseur » — le pendant en filtre de la
   * pastille de la liste, et ce qui permet de composer une sélection à corriger
   * en masse. Exclusif du choix d'un fournisseur (voir `onWithoutSupplierToggle`).
   */
  withoutSupplier: boolean;
  onWithoutSupplierToggle: () => void;
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
  withoutSupplier,
  onWithoutSupplierToggle,
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

      {/* La pastille « sans fournisseur » s'affiche même sans aucun fournisseur
          connu : c'est précisément le cas où tout en manque, donc celui où le
          filtre sert le plus. La rendre dépendante de `supplierOptions` l'aurait
          cachée à qui n'a encore rien nommé. */}
      <div className="flex flex-wrap gap-1.5">
        <FilterPill
          active={supplier === '' && !withoutSupplier}
          onClick={() => onSupplierChange('')}
        >
          {t('expenses.filters.allSuppliers')}
        </FilterPill>
        <FilterPill active={withoutSupplier} onClick={onWithoutSupplierToggle}>
          {t('expenses.filters.withoutSupplier')}
        </FilterPill>
        {supplierOptions.map((value) => (
          <FilterPill
            key={value}
            active={!withoutSupplier && supplier === value}
            onClick={() => onSupplierChange(value)}
          >
            {value}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}
