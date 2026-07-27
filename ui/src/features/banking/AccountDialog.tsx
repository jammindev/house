import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import type { BankAccount, BankAccountKind } from '@/lib/api/banking';
import { useCreateBankAccount, useUpdateBankAccount } from './hooks';
import { todayISO } from '@/lib/format';

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = création, défini = édition. */
  existing?: BankAccount;
}

export default function AccountDialog({ open, onOpenChange, existing }: AccountDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateBankAccount();
  const updateMutation = useUpdateBankAccount();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<BankAccountKind>('bank');
  const [bankLabel, setBankLabel] = React.useState('');
  const [ibanLast4, setIbanLast4] = React.useState('');
  const [openingBalance, setOpeningBalance] = React.useState('');
  const [openingBalanceDate, setOpeningBalanceDate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      setName(existing.name);
      setKind(existing.kind);
      setBankLabel(existing.bank_label);
      setIbanLast4(existing.iban_last4);
      setOpeningBalance(existing.opening_balance);
      setOpeningBalanceDate(existing.opening_balance_date ?? '');
    } else {
      setName('');
      setKind('bank');
      setBankLabel('');
      setIbanLast4('');
      setOpeningBalance('');
      // Aujourd'hui par défaut : le cas le plus fréquent est « je commence à suivre
      // ce compte maintenant », et proposer une valeur juste vaut mieux qu'exiger
      // une saisie de plus.
      setOpeningBalanceDate(todayISO());
    }
  }, [open, existing]);

  // Un compte espèces n'a ni banque ni IBAN — le backend efface ces champs de
  // toute façon, on ne les affiche donc pas.
  const isCash = kind === 'cash';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('banking.errors.nameRequired'));
      return;
    }

    // Le solde d'ouverture peut être négatif (découvert) : on ne valide que la
    // forme numérique, jamais le signe.
    const rawBalance = openingBalance.trim().replace(',', '.');
    if (rawBalance && !Number.isFinite(Number(rawBalance))) {
      setError(t('banking.errors.openingBalanceInvalid'));
      return;
    }

    // Requise à la création (parcours 26, lot 7) : sans point de départ le solde est
    // une supposition, et aucun contrôle de conformité ne porte sur le compte. Pas
    // exigée à l'édition — un simple renommage ne doit pas être bloqué par un champ
    // sans rapport, le détecteur est là pour ça.
    if (!isEditing && !openingBalanceDate) {
      setError(t('banking.errors.openingBalanceDateRequired'));
      return;
    }

    const payload = {
      name: name.trim(),
      kind,
      bank_label: isCash ? '' : bankLabel.trim(),
      iban_last4: isCash ? '' : ibanLast4.trim(),
      opening_balance: rawBalance || '0',
      opening_balance_date: openingBalanceDate || null,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('banking.edit.title') : t('banking.new.title')}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <FormField label={`${t('banking.fields.name')} *`} htmlFor="account-name">
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('banking.fields.namePlaceholder')}
            autoFocus
          />
        </FormField>

        <FormField label={t('banking.fields.kind')} htmlFor="account-kind">
          <Select
            id="account-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as BankAccountKind)}
            disabled={isEditing}
            options={[
              { value: 'bank', label: t('banking.kinds.bank') },
              { value: 'cash', label: t('banking.kinds.cash') },
            ]}
          />
        </FormField>

        {!isCash ? (
          <>
            <FormField label={t('banking.fields.bankLabel')} htmlFor="account-bank">
              <Input
                id="account-bank"
                value={bankLabel}
                onChange={(e) => setBankLabel(e.target.value)}
                placeholder={t('banking.fields.bankLabelPlaceholder')}
              />
            </FormField>

            <FormField label={t('banking.fields.ibanLast4')} htmlFor="account-iban">
              <Input
                id="account-iban"
                value={ibanLast4}
                onChange={(e) => setIbanLast4(e.target.value.slice(0, 4))}
                maxLength={4}
                placeholder="1234"
              />
              <p className="text-xs text-muted-foreground">{t('banking.fields.ibanLast4Hint')}</p>
            </FormField>
          </>
        ) : null}

        <FormField label={t('banking.fields.openingBalance')} htmlFor="account-opening-balance">
          <Input
            id="account-opening-balance"
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">
            {t('banking.fields.openingBalanceHint')}
          </p>
        </FormField>

        <FormField
          label={`${t('banking.fields.openingBalanceDate')}${isEditing ? '' : ' *'}`}
          htmlFor="account-opening-date"
        >
          <Input
            id="account-opening-date"
            type="date"
            value={openingBalanceDate}
            onChange={(e) => setOpeningBalanceDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('banking.fields.openingBalanceDateHint')}
          </p>
        </FormField>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
