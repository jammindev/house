import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';

/**
 * La fenêtre d'une courbe de solde — partagée par la fiche d'un compte et
 * l'onglet Comptes.
 *
 * Partagée et non copiée pour une raison de lecture, pas d'économie de lignes :
 * passer d'un écran à l'autre avec deux jeux de périodes différents demanderait
 * de recaler l'œil à chaque fois, et la comparaison entre « mon compte » et « le
 * foyer » est précisément ce qu'on vient faire.
 *
 * `0` = toute la vie du compte ; le serveur borne alors la courbe à sa date de
 * solde d'ouverture (`banking.history`), donc « tout » ne veut jamais dire
 * « avant que le compte existe ».
 */
export const BALANCE_WINDOWS = [3, 12, 0] as const;

export type BalanceWindow = (typeof BALANCE_WINDOWS)[number];

export const DEFAULT_BALANCE_WINDOW: BalanceWindow = 12;

export function BalanceWindowPills({
  value,
  onChange,
}: {
  value: BalanceWindow;
  onChange: (next: BalanceWindow) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1.5">
      {BALANCE_WINDOWS.map((months) => (
        <FilterPill key={months} active={value === months} onClick={() => onChange(months)}>
          {months === 0
            ? t('banking.history.window.all')
            : t('banking.history.window.months', { count: months })}
        </FilterPill>
      ))}
    </div>
  );
}
