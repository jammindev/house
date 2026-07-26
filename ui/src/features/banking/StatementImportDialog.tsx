import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import type { BankAccount, StatementImport, StatementMapping } from '@/lib/api/banking';
import { useImportStatementFile, usePreviewStatementFile } from './hooks';

interface StatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount;
}

/** Étapes : choisir le fichier → décrire les colonnes → lire le résultat. */
type Stage = 'file' | 'mapping' | 'result';

const EMPTY_MAPPING: StatementMapping = { date_column: '', label_column: '', amount_column: '' };

export default function StatementImportDialog({
  open,
  onOpenChange,
  account,
}: StatementImportDialogProps) {
  const { t } = useTranslation();
  const previewMutation = usePreviewStatementFile();
  const importMutation = useImportStatementFile();

  const [stage, setStage] = React.useState<Stage>('file');
  const [file, setFile] = React.useState<File | null>(null);
  const [provider, setProvider] = React.useState('generic_csv');
  const [columns, setColumns] = React.useState<string[]>([]);
  const [sampleLines, setSampleLines] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<StatementMapping>(EMPTY_MAPPING);
  const [useDebitCredit, setUseDebitCredit] = React.useState(false);
  const [result, setResult] = React.useState<StatementImport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStage('file');
    setFile(null);
    setColumns([]);
    setSampleLines([]);
    setResult(null);
    setError(null);
    // Le mapping mémorisé du compte est ce qui rend le 2ᵉ import instantané.
    // `import_options` est un blob JSON côté API : le double cast est assumé, et
    // la présence de `date_column` sert de contrôle de forme minimal.
    const remembered = account.import_options as unknown as Partial<StatementMapping>;
    const hasRemembered = Boolean(remembered?.date_column);
    setMapping(hasRemembered ? { ...EMPTY_MAPPING, ...remembered } : EMPTY_MAPPING);
    setUseDebitCredit(Boolean(remembered?.debit_column));
    setProvider(account.default_provider || 'generic_csv');
  }, [open, account]);

  function set<K extends keyof StatementMapping>(key: K, value: StatementMapping[K]) {
    setMapping((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFileChosen(chosen: File) {
    setFile(chosen);
    setError(null);
    // Un .xlsx doit être lu par l'adaptateur Excel, pas par le lecteur CSV.
    const isExcel = /\.xlsx?$/i.test(chosen.name);
    setProvider(isExcel ? 'generic_xlsx' : 'generic_csv');
    try {
      const preview = await previewMutation.mutateAsync(chosen);
      setColumns(preview.columns);
      setSampleLines(preview.sample_lines);
      setStage('mapping');
    } catch {
      setError(t('banking.import.errors.previewFailed'));
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return;

    if (!mapping.date_column || !mapping.label_column) {
      setError(t('banking.import.errors.mappingIncomplete'));
      return;
    }
    if (useDebitCredit ? !(mapping.debit_column && mapping.credit_column) : !mapping.amount_column) {
      setError(t('banking.import.errors.mappingIncomplete'));
      return;
    }

    // On n'envoie jamais les deux formes de montant : le backend les refuse.
    const options: StatementMapping = { ...mapping };
    if (useDebitCredit) {
      delete options.amount_column;
    } else {
      delete options.debit_column;
      delete options.credit_column;
    }

    try {
      const imported = await importMutation.mutateAsync({
        accountId: account.id,
        file,
        provider,
        options,
      });
      setResult(imported);
      setStage('result');
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const columnOptions = [
    { value: '', label: t('banking.import.fields.none') },
    ...columns.map((c) => ({ value: c, label: c })),
  ];

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('banking.import.title', { account: account.name })}
    >
      {stage === 'file' ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{t('banking.import.intro')}</p>

          <FormField label={t('banking.import.fields.file')} htmlFor="statement-file">
            <Input
              id="statement-file"
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) void handleFileChosen(chosen);
              }}
            />
          </FormField>

          {previewMutation.isPending ? (
            <p className="text-sm text-muted-foreground">{t('banking.import.reading')}</p>
          ) : null}

          {error ? <ErrorBox message={error} /> : null}

          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'mapping' ? (
        <form onSubmit={handleImport} className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{t('banking.import.mappingIntro')}</p>

          {sampleLines.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-2">
              <pre className="text-xs text-muted-foreground">{sampleLines.slice(0, 4).join('\n')}</pre>
            </div>
          ) : null}

          <FormField label={`${t('banking.import.fields.dateColumn')} *`} htmlFor="map-date">
            <Select
              id="map-date"
              value={mapping.date_column}
              onChange={(e) => set('date_column', e.target.value)}
              options={columnOptions}
            />
          </FormField>

          <FormField label={`${t('banking.import.fields.labelColumn')} *`} htmlFor="map-label">
            <Select
              id="map-label"
              value={mapping.label_column}
              onChange={(e) => set('label_column', e.target.value)}
              options={columnOptions}
            />
          </FormField>

          <CheckboxField
            id="map-debit-credit"
            label={t('banking.import.fields.useDebitCredit')}
            checked={useDebitCredit}
            onChange={setUseDebitCredit}
          />

          {useDebitCredit ? (
            <>
              <FormField label={`${t('banking.import.fields.debitColumn')} *`} htmlFor="map-debit">
                <Select
                  id="map-debit"
                  value={mapping.debit_column ?? ''}
                  onChange={(e) => set('debit_column', e.target.value)}
                  options={columnOptions}
                />
              </FormField>
              <FormField label={`${t('banking.import.fields.creditColumn')} *`} htmlFor="map-credit">
                <Select
                  id="map-credit"
                  value={mapping.credit_column ?? ''}
                  onChange={(e) => set('credit_column', e.target.value)}
                  options={columnOptions}
                />
              </FormField>
            </>
          ) : (
            <FormField label={`${t('banking.import.fields.amountColumn')} *`} htmlFor="map-amount">
              <Select
                id="map-amount"
                value={mapping.amount_column ?? ''}
                onChange={(e) => set('amount_column', e.target.value)}
                options={columnOptions}
              />
            </FormField>
          )}

          <FormField label={t('banking.import.fields.balanceColumn')} htmlFor="map-balance">
            <Select
              id="map-balance"
              value={mapping.balance_column ?? ''}
              onChange={(e) => set('balance_column', e.target.value)}
              options={columnOptions}
            />
            <p className="text-xs text-muted-foreground">
              {t('banking.import.fields.balanceColumnHint')}
            </p>
          </FormField>

          <FormField label={t('banking.import.fields.decimalSeparator')} htmlFor="map-decimal">
            <Select
              id="map-decimal"
              value={mapping.decimal_separator ?? ''}
              onChange={(e) => set('decimal_separator', e.target.value)}
              options={[
                { value: '', label: t('banking.import.fields.autoDetect') },
                { value: ',', label: t('banking.import.fields.comma') },
                { value: '.', label: t('banking.import.fields.dot') },
              ]}
            />
          </FormField>

          <CheckboxField
            id="map-invert"
            label={t('banking.import.fields.invertSign')}
            checked={Boolean(mapping.invert_sign)}
            onChange={(v) => set('invert_sign', v)}
          />

          {error ? <ErrorBox message={error} /> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={importMutation.isPending}>
              {t('banking.import.action')}
            </Button>
          </div>
        </form>
      ) : null}

      {stage === 'result' && result ? (
        <div className="mt-4 space-y-4">
          <ImportOutcome result={result} />
          <div className="flex justify-end gap-2 pt-2">
            {result.status === 'failed' ? (
              <Button type="button" variant="outline" onClick={() => setStage('mapping')}>
                {t('banking.import.fixMapping')}
              </Button>
            ) : null}
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : null}
    </SheetDialog>
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
 * Trois issues à raconter distinctement : lignes ajoutées, tout en doublon
 * (le réimport, qui est un succès et non une erreur), et fichier illisible.
 */
function ImportOutcome({ result }: { result: StatementImport }) {
  const { t } = useTranslation();

  if (result.status === 'failed') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {t('banking.import.result.failed')}
        </p>
        <p className="mt-1 text-xs text-destructive">{result.error}</p>
      </div>
    );
  }

  if (result.created_count === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Info className="h-4 w-4" aria-hidden />
          {t('banking.import.result.nothingNew')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('banking.import.result.skipped', { count: result.skipped_count })}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {t('banking.import.result.created', { count: result.created_count })}
      </p>
      {result.skipped_count > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('banking.import.result.skipped', { count: result.skipped_count })}
        </p>
      ) : null}
    </div>
  );
}
