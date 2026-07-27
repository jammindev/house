import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { formatAmount } from '@/lib/format';
import type { BankAccount } from '@/lib/api/banking';
import { useBalanceAnchor, useSetBalanceAnchor } from './hooks';

interface BalanceAnchorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount;
}

/**
 * Retrouver le solde d'ouverture (parcours 26, lot 8).
 *
 * Le solde dérivé réclame un solde à une date **passée** ; une appli bancaire ne
 * montre que celui d'**aujourd'hui**, et l'export Crédit Agricole ne porte aucune
 * colonne solde. L'utilisateur ne peut donc pas fournir ce que le formulaire
 * demande — d'où les comptes ouverts « aujourd'hui », fenêtre de conformité vide,
 * contrôle muet.
 *
 * Ce dialog inverse la demande : il réclame ce que l'utilisateur **peut** lire, et
 * fait la soustraction lui-même. Deux voies, la plus sûre d'abord :
 *
 * - le relevé porte le solde → on l'applique, on ne demande rien ;
 * - il ne le porte pas → l'utilisateur atteste son solde du jour, et House lui
 *   montre le calcul entier avant d'écrire. Un chiffre qu'on ne peut pas refaire
 *   à la main est un chiffre qu'on ne peut pas vérifier.
 *
 * Le blocage sur période manquante n'est pas une politesse : une semaine jamais
 * importée rendrait la soustraction courte d'un montant inconnu, définitivement
 * enfoui dans le solde d'ouverture.
 */
export default function BalanceAnchorDialog({
  open,
  onOpenChange,
  account,
}: BalanceAnchorDialogProps) {
  const { t } = useTranslation();
  const contextQuery = useBalanceAnchor(open ? account.id : undefined);
  const anchor = useSetBalanceAnchor();

  const [balance, setBalance] = React.useState('');
  const [asOf, setAsOf] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setBalance('');
    setAsOf(new Date().toISOString().slice(0, 10));
    setConfirmed(false);
    setError(null);
  }, [open]);

  const context = contextQuery.data;
  const gaps = context?.gaps ?? [];
  const blocked = gaps.length > 0;

  // Le solde du jour moins tout ce qui a bougé depuis la première ligne. Calculé
  // ici uniquement pour l'aperçu — le serveur refait la soustraction, parce qu'un
  // montant calculé par le client n'a rien à faire en base.
  const parsed = Number(balance.trim().replace(',', '.'));
  const preview =
    context && balance.trim() && Number.isFinite(parsed)
      ? parsed - Number(context.movements)
      : null;

  async function apply(payload?: { balance: string; as_of: string }) {
    setError(null);
    try {
      await anchor.mutateAsync({ accountId: account.id, payload });
      onOpenChange(false);
    } catch (err) {
      setError(readServerError(err, t));
    }
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.anchor.title')}>
      {contextQuery.isLoading || !context ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" />
      ) : context.source === 'none' ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('banking.anchor.noLines')}</p>
      ) : context.source === 'statement' ? (
        <div className="mt-4 space-y-4">
          <Card className="flex gap-3 p-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                {t('banking.anchor.fromStatement')}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t('banking.anchor.fromStatementDetail', {
                  amount: formatAmount(context.proposed_opening_balance ?? '0'),
                  date: formatDate(context.proposed_opening_date),
                })}
              </p>
            </div>
          </Card>

          {error ? <ErrorBox message={error} /> : null}

          <Footer
            onCancel={() => onOpenChange(false)}
            onSubmit={() => void apply()}
            disabled={anchor.isPending}
            label={t('banking.anchor.apply')}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{t('banking.anchor.intro')}</p>

          {blocked ? (
            <Card className="flex gap-3 border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <div className="min-w-0 text-sm text-destructive">
                <p className="font-medium">{t('banking.anchor.gapTitle')}</p>
                <p className="mt-1">
                  {t('banking.anchor.gapDetail', {
                    start: formatDate(gaps[0].gap_start),
                    end: formatDate(gaps[0].gap_end),
                  })}
                </p>
              </div>
            </Card>
          ) : null}

          <FormField label={t('banking.anchor.balanceLabel')} htmlFor="anchor-balance">
            <Input
              id="anchor-balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              disabled={blocked}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t('banking.anchor.balanceHint')}</p>
          </FormField>

          <FormField label={t('banking.anchor.asOfLabel')} htmlFor="anchor-as-of">
            <Input
              id="anchor-as-of"
              type="date"
              value={asOf}
              min={context.latest_line ?? undefined}
              onChange={(e) => setAsOf(e.target.value)}
              disabled={blocked}
            />
          </FormField>

          {/* La seule chose que House ne peut pas vérifier : que le relevé importé
              va bien jusqu'au solde lu. On la demande explicitement, en montrant
              l'opération à comparer — pas une case à cocher dans le vide. */}
          {context.last_operation ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={blocked}
              />
              <span className="min-w-0">
                <span className="text-foreground">{t('banking.anchor.confirmLast')}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatDate(context.last_operation.booked_on)} ·{' '}
                  {context.last_operation.label} ·{' '}
                  {formatAmount(context.last_operation.amount)}
                </span>
              </span>
            </label>
          ) : null}

          {/* Le calcul en clair : sans lui l'utilisateur valide un chiffre sorti de
              nulle part, et ne peut ni le recouper ni repérer une erreur de saisie. */}
          {preview !== null && context.earliest_line ? (
            <Card className="p-3 text-sm">
              <p className="text-muted-foreground">
                {t('banking.anchor.computation', {
                  balance: formatAmount(parsed),
                  movements: formatAmount(context.movements),
                })}
              </p>
              <p className="mt-1 font-medium text-foreground">
                {t('banking.anchor.result', {
                  amount: formatAmount(preview),
                  date: formatDate(context.earliest_line),
                })}
              </p>
            </Card>
          ) : null}

          {error ? <ErrorBox message={error} /> : null}

          <Footer
            onCancel={() => onOpenChange(false)}
            onSubmit={() => void apply({ balance: balance.trim().replace(',', '.'), as_of: asOf })}
            disabled={
              anchor.isPending || blocked || !confirmed || preview === null || !asOf
            }
            label={t('banking.anchor.apply')}
          />
        </div>
      )}
    </SheetDialog>
  );
}

function Footer({
  onCancel,
  onSubmit,
  disabled,
  label,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  disabled: boolean;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-2 pt-2">
      {/* Jamais désactivé pendant la mutation : sortir du dialog doit rester
          possible même si l'appel traîne. */}
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button type="button" onClick={onSubmit} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

/**
 * Le serveur renvoie un `code` par refus. Le nommer vaut mieux qu'un « échec de
 * l'enregistrement » : chaque refus correspond à une action précise de
 * l'utilisateur.
 */
function readServerError(err: unknown, t: (key: string) => string): string {
  const data = (err as { response?: { data?: { code?: string } } })?.response?.data;
  const code = data?.code;
  if (code === 'as_of_before_last_line') return t('banking.anchor.errors.beforeLastLine');
  if (code === 'as_of_in_future') return t('banking.anchor.errors.future');
  if (code === 'period_gap') return t('banking.anchor.errors.periodGap');
  if (code === 'no_transactions') return t('banking.anchor.errors.noLines');
  return t('common.saveFailed');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}
