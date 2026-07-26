import { useTranslation } from 'react-i18next';
import { ArchiveRestore, Banknote, Landmark, Pencil, Trash2, Upload } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatAmount } from '@/lib/format';
import type { BankAccount } from '@/lib/api/banking';

interface AccountCardProps {
  account: BankAccount;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onImport: () => void;
}

export default function AccountCard({
  account,
  onEdit,
  onArchive,
  onRestore,
  onImport,
}: AccountCardProps) {
  const { t } = useTranslation();
  const isCash = account.kind === 'cash';
  const Icon = isCash ? Banknote : Landmark;

  const actions: CardAction[] = account.archived
    ? [{ label: t('banking.reopen'), icon: ArchiveRestore, onClick: onRestore }]
    : [
        // Un compte espèces n'a pas de relevé à importer : ses opérations se
        // saisissent à la main (lot 4).
        ...(isCash
          ? []
          : [{ label: t('banking.import.action'), icon: Upload, onClick: onImport }]),
        { label: t('common.edit'), icon: Pencil, onClick: onEdit },
        { label: t('banking.archive'), icon: Trash2, onClick: onArchive, variant: 'danger' as const },
      ];

  // Sous-titre : la banque et les 4 derniers de l'IBAN quand ils existent —
  // c'est ce qui permet de distinguer deux comptes de la même banque.
  const details = [account.bank_label, account.iban_last4 ? `••••${account.iban_last4}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{account.name}</CardTitle>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {details || t(isCash ? 'banking.kinds.cash' : 'banking.kinds.bank')}
            </p>

            {account.opening_balance_date ? (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {t('banking.openingBalanceOn', {
                  amount: formatAmount(account.opening_balance),
                  date: new Date(account.opening_balance_date).toLocaleDateString(),
                })}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t('banking.noOpeningBalance')}</p>
            )}

            {account.archived ? (
              <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {t('banking.archived')}
              </span>
            ) : null}
          </div>
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
