import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import type { AccountBalance } from '@/lib/api/banking';

interface BalanceBadgeProps {
  balance: AccountBalance | undefined;
  isLoading: boolean;
}

/**
 * Solde d'un compte, avec son degré de confiance.
 *
 * Quand la chaîne des relevés est rompue, on affiche le montant **et**
 * l'avertissement plutôt que de le masquer : le chiffre reste celui de la banque,
 * c'est sa continuité qui n'est pas garantie. Un solde faux affiché avec aplomb
 * serait pire que les deux.
 */
export default function BalanceBadge({ balance, isLoading }: BalanceBadgeProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <span className="inline-block h-5 w-20 animate-pulse rounded bg-muted" />;
  }
  if (!balance) return null;

  const isNegative = Number(balance.amount) < 0;

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={`text-sm font-semibold tabular-nums ${
          isNegative ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {formatAmount(balance.amount)}
      </span>

      {!balance.is_reliable ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
          title={
            balance.gaps.length > 0
              ? t('banking.balance.chainBrokenShort')
              : t('banking.balance.noOpeningDateShort')
          }
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {t('banking.balance.uncertain')}
        </span>
      ) : null}
    </span>
  );
}
