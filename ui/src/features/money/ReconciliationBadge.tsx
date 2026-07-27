import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, CircleDashed, Coins, HelpCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { BankLineRef, ReconciliationState } from '@/lib/api/interactions';

interface ReconciliationBadgeProps {
  state: ReconciliationState | undefined;
  /** La ligne qui justifie la dépense — rend le badge cliquable quand elle existe. */
  line?: BankLineRef | null;
  /** `false` sur une carte déjà cliquable : un lien dans un lien ne s'ouvre pas. */
  linked?: boolean;
  className?: string;
}

const STYLES: Record<Exclude<ReconciliationState, ''>, string> = {
  attested: 'bg-primary/10 text-primary',
  cash: 'bg-primary/10 text-primary',
  // Hors fenêtre, House n'exige rien : en gris, jamais en rouge — un reproche
  // qu'on ne peut pas résoudre est ce qui fait abandonner le contrôle.
  out_of_scope: 'bg-muted text-muted-foreground',
  pending: 'bg-destructive/10 text-destructive',
};

const ICONS: Record<Exclude<ReconciliationState, ''>, typeof Banknote> = {
  attested: Banknote,
  cash: Coins,
  out_of_scope: CircleDashed,
  pending: HelpCircle,
};

/**
 * Est-ce qu'une ligne de relevé justifie cette dépense — et laquelle.
 *
 * ⚠️ L'état vient du serveur (`reconciliation_state`), il n'est **pas** dérivé
 * de `bank_transaction`. Le verdict dépend de la fenêtre de conformité du foyer
 * et doit rester celui que compte l'onglet Contrôle ; une dépense verte ici et
 * un écart là-bas, et les deux écrans perdent leur crédit. Miroir exact de
 * `AllocationBadge` côté journal bancaire.
 *
 * Quand la ligne existe, le badge y mène : « rapprochée » sans pouvoir aller
 * voir *à quoi* reste une affirmation que l'utilisateur ne peut pas vérifier.
 */
export default function ReconciliationBadge({
  state,
  line,
  linked = true,
  className = '',
}: ReconciliationBadgeProps) {
  const { t } = useTranslation();

  if (!state) return null;

  const Icon = ICONS[state];
  const label =
    line && (state === 'attested' || state === 'cash')
      ? t(`money.reconciliation.${state}`, { date: formatDate(line.booked_on) })
      : t(`money.reconciliation.${state}`);

  const body = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </>
  );
  const shell = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${STYLES[state]} ${className}`;

  if (!line || !linked) {
    return (
      <span className={shell} title={line ? `${line.account_name} · ${line.label}` : undefined}>
        {body}
      </span>
    );
  }

  return (
    <Link
      to={`/app/money/transactions/${line.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`${shell} hover:underline`}
      title={`${line.account_name} · ${line.label}`}
    >
      {body}
    </Link>
  );
}
