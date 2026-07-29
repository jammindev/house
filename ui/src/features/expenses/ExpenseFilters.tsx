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
  /**
   * La période fait-elle partie de ce bloc ? Oui dans l'onglet Dépenses, où elle
   * borne exactement la même chose que les pastilles.
   *
   * **Non sur la fiche d'un budget**, et pas par mise en page : là-bas la
   * période pilote *toute* la page (le total, sa comparaison au plafond, la
   * courbe, l'anneau) tandis que ces pastilles ne réduisent que la liste.
   * Réunir les deux dans un même bloc promettrait que tout obéit à tout — or un
   * sous-total filtré comparé à un plafond entier dit toujours « tu es large ».
   * Elle reste donc en tête de page, où l'on voit ce qu'elle recalcule.
   */
  showPeriod?: boolean;
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
  showPeriod = true,
}: ExpenseFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {showPeriod ? (
        <PeriodPicker period={period} onChange={onPeriodChange} idPrefix="expenses" />
      ) : null}

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
