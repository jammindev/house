import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { toast } from '@/lib/toast';
import type {
  ElectricityMeter,
  EnergyRegister,
  ImportOptions,
  ImportPreview,
} from '@/lib/api/electricity';
import { usePreviewConsumptionImport, useUpdateMeter, useUploadConsumptionImport } from './hooks';
import { ENEDIS_EXPORT_URL } from './exportProviders';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: ElectricityMeter;
}

/**
 * Shortcut to the provider page where the export file is downloaded, so the
 * user does not have to navigate the portal by hand at every import. The URL is
 * saved on the meter and can be recorded straight from here.
 */
function ExportLinkBlock({ meter, open }: { meter: ElectricityMeter; open: boolean }) {
  const { t } = useTranslation();
  const savedUrl = meter.export_url?.trim() ?? '';
  const [editing, setEditing] = React.useState(!savedUrl);
  const [draft, setDraft] = React.useState(savedUrl);
  const [error, setError] = React.useState<string | null>(null);
  const updateMeter = useUpdateMeter();

  // Reopening the dialog, switching meter or saving resets to the stored state.
  React.useEffect(() => {
    setDraft(savedUrl);
    setEditing(!savedUrl);
    setError(null);
  }, [savedUrl, meter.id, open]);

  async function handleSave() {
    const value = draft.trim();
    setError(null);
    if (value && !/^https?:\/\/\S+$/i.test(value)) {
      setError(t('electricity.import.linkInvalid'));
      return;
    }
    try {
      await updateMeter.mutateAsync({ id: meter.id, payload: { export_url: value } });
      setEditing(false);
    } catch {
      // the mutation already surfaces a toast — keep the field open for a retry
    }
  }

  if (!editing && savedUrl) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href={savedUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {t('electricity.import.openExportPage')}
          </a>
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setEditing(true)}>
            {t('electricity.import.linkEdit')}
          </button>
        </div>
        <p className="truncate pt-1 text-xs text-muted-foreground">{savedUrl}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
      <FormField label={t('electricity.import.linkLabel')} htmlFor="import-export-url">
        <Input
          id="import-export-url"
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={ENEDIS_EXPORT_URL}
        />
        <p className="text-xs text-muted-foreground">{t('electricity.import.linkHint')}</p>
      </FormField>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {savedUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft(savedUrl); setEditing(false); setError(null); }}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={updateMeter.isPending || !draft.trim()}
          onClick={() => void handleSave()}
        >
          {t('electricity.import.linkSave')}
        </Button>
      </div>
    </div>
  );
}

export default function ImportDialog({ open, onOpenChange, meter }: ImportDialogProps) {
  const { t } = useTranslation();

  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [useGeneric, setUseGeneric] = React.useState(false);
  const [timestampColumn, setTimestampColumn] = React.useState('');
  const [valueColumn, setValueColumn] = React.useState('');
  const [unit, setUnit] = React.useState<ImportOptions['unit']>('kwh');
  const [intervalMinutes, setIntervalMinutes] = React.useState('30');
  const [register, setRegister] = React.useState<EnergyRegister>('base');
  const [error, setError] = React.useState<string | null>(null);

  const previewImport = usePreviewConsumptionImport();
  const uploadImport = useUploadConsumptionImport();

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setUseGeneric(false);
    setTimestampColumn('');
    setValueColumn('');
    setUnit('kwh');
    setIntervalMinutes('30');
    setRegister('base');
    setError(null);
  }, [open]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setError(null);
    if (!selected) return;
    try {
      const result = await previewImport.mutateAsync(selected);
      setPreview(result);
      setUseGeneric(!result.detected_provider);
      if (result.columns.length >= 2) {
        setTimestampColumn(result.columns[0]);
        setValueColumn(result.columns[1]);
      }
    } catch {
      setError(t('electricity.import.previewFailed'));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t('electricity.import.fileRequired'));
      return;
    }

    const generic = useGeneric || !preview?.detected_provider;
    try {
      const result = await uploadImport.mutateAsync({
        meter: meter.id,
        file,
        provider: generic ? 'generic_csv' : undefined,
        options: generic
          ? {
              timestamp_column: timestampColumn,
              value_column: valueColumn,
              unit,
              interval_minutes: Number(intervalMinutes),
              register,
            }
          : undefined,
      });
      if (result.status === 'failed') {
        setError(result.error || t('electricity.import.failed'));
        return;
      }
      toast({
        description: t('electricity.import.done', {
          created: result.created_count,
          skipped: result.skipped_count,
        }),
        variant: 'success',
      });
      onOpenChange(false);
    } catch {
      setError(t('electricity.import.failed'));
    }
  }

  const columnOptions = (preview?.columns ?? []).map((c) => ({ value: c, label: c }));
  const isPending = uploadImport.isPending || previewImport.isPending;

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('electricity.import.title')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <ExportLinkBlock meter={meter} open={open} />

        <FormField label={t('electricity.import.file')} htmlFor="import-file">
          <Input id="import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void handleFileChange(e)} />
        </FormField>

        {preview?.detected_provider && !useGeneric ? (
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p>
              {t('electricity.import.detected')}{' '}
              <span className="font-medium">{t(`electricity.import.provider.${preview.detected_provider}`)}</span>
            </p>
            <button
              type="button"
              className="mt-1 text-xs text-primary underline"
              onClick={() => setUseGeneric(true)}
            >
              {t('electricity.import.useGenericInstead')}
            </button>
          </div>
        ) : null}

        {preview && (useGeneric || !preview.detected_provider) ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('electricity.import.mappingHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('electricity.import.timestampColumn')} htmlFor="import-ts-col">
                <Select
                  id="import-ts-col"
                  value={timestampColumn}
                  onChange={(e) => setTimestampColumn(e.target.value)}
                  options={columnOptions}
                />
              </FormField>
              <FormField label={t('electricity.import.valueColumn')} htmlFor="import-value-col">
                <Select
                  id="import-value-col"
                  value={valueColumn}
                  onChange={(e) => setValueColumn(e.target.value)}
                  options={columnOptions}
                />
              </FormField>
              <FormField label={t('electricity.import.unit')} htmlFor="import-unit">
                <Select
                  id="import-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as ImportOptions['unit'])}
                  options={[
                    { value: 'kwh', label: 'kWh' },
                    { value: 'wh', label: 'Wh' },
                    { value: 'w_avg', label: t('electricity.import.unitWavg') },
                  ]}
                />
              </FormField>
              <FormField label={t('electricity.import.intervalMinutes')} htmlFor="import-interval">
                <Input
                  id="import-interval"
                  type="number"
                  min="1"
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                />
              </FormField>
            </div>
            {meter.tariff_type === 'hp_hc' ? (
              <FormField label={t('electricity.consumption.registerLabel')} htmlFor="import-register">
                <Select
                  id="import-register"
                  value={register}
                  onChange={(e) => setRegister(e.target.value as EnergyRegister)}
                  options={(['base', 'hp', 'hc'] as EnergyRegister[]).map((r) => ({
                    value: r,
                    label: t(`electricity.consumption.register.${r}`),
                  }))}
                />
              </FormField>
            ) : null}
          </div>
        ) : null}

        {preview?.sample_lines.length ? (
          <div className="max-h-28 overflow-auto rounded-lg border border-border bg-muted/30 p-2">
            <pre className="text-[11px] leading-4 text-muted-foreground">
              {preview.sample_lines.slice(0, 6).join('\n')}
            </pre>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!file || isPending}>
            {t('electricity.import.submit')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
