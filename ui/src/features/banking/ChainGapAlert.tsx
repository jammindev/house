import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import type { AccountBalance } from '@/lib/api/banking';

interface ChainGapAlertProps {
  balance: AccountBalance;
  accountName: string;
}

/**
 * Avertissement de rupture de chaîne.
 *
 * C'est le prix assumé du suivi de solde : si un relevé manque, le solde dérive.
 * L'app ne peut pas l'inventer, mais elle peut le **détecter** — et le dire, avec
 * l'intervalle exact et le montant manquant, plutôt que d'afficher un chiffre
 * plausible et faux.
 */
export default function ChainGapAlert({ balance, accountName }: ChainGapAlertProps) {
  const { t } = useTranslation();

  if (balance.is_reliable) return null;

  // Pas de trou détecté mais solde non fiable = solde d'ouverture jamais renseigné,
  // donc on somme depuis un point de départ supposé. Message différent.
  if (balance.gaps.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('banking.balance.noOpeningDate.title')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('banking.balance.noOpeningDate.body', { account: accountName })}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t('banking.balance.chainBroken.title', { account: accountName })}
      </p>

      <ul className="mt-2 space-y-1">
        {balance.gaps.map((gap) => (
          <li key={gap.after_transaction_id} className="text-xs text-destructive">
            {t('banking.balance.chainBroken.gap', {
              from: new Date(gap.gap_start).toLocaleDateString(),
              to: new Date(gap.gap_end).toLocaleDateString(),
              amount: formatAmount(gap.missing_amount),
            })}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-destructive/80">
        {t('banking.balance.chainBroken.hint')}
      </p>
    </div>
  );
}
