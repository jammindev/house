import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { useCreateLink } from './hooks';
import type { ElectricCircuit, UsagePoint } from '@/lib/api/electricity';

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circuits: ElectricCircuit[];
  usagePoints: UsagePoint[];
}

export default function LinkDialog({ open, onOpenChange, circuits, usagePoints }: LinkDialogProps) {
  const { t } = useTranslation();

  const [circuitId, setCircuitId] = React.useState('');
  const [usagePointId, setUsagePointId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createLink = useCreateLink();

  React.useEffect(() => {
    if (!open) return;
    setCircuitId('');
    setUsagePointId('');
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!circuitId) { setError(t('electricity.link.circuitRequired')); return; }
    if (!usagePointId) { setError(t('electricity.link.usagePointRequired')); return; }

    try {
      await createLink.mutateAsync({ circuitId, usagePointId });
      onOpenChange(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (data) {
        const first = Object.values(data).flat()[0];
        setError(first ?? t('common.saveFailed'));
      } else {
        setError(t('common.saveFailed'));
      }
    }
  }

  const circuitOptions = circuits
    .filter((c) => c.is_active !== false)
    .map((c) => ({ value: c.id, label: `${c.label} — ${c.name}` }));

  const usagePointOptions = usagePoints.map((u) => ({
    value: u.id,
    label: `${u.label} — ${u.name}`,
  }));

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('electricity.link.new')}
    >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <FormField label={t('electricity.link.circuit')} htmlFor="link-circuit">
            <Select
              id="link-circuit"
              value={circuitId}
              onChange={(e) => setCircuitId(e.target.value)}
              options={circuitOptions}
              placeholder={t('electricity.selectCircuit')}
              required
            />
          </FormField>

          <FormField label={t('electricity.link.usagePoint')} htmlFor="link-up">
            <Select
              id="link-up"
              value={usagePointId}
              onChange={(e) => setUsagePointId(e.target.value)}
              options={usagePointOptions}
              placeholder={t('electricity.selectUsagePoint')}
              required
            />
          </FormField>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createLink.isPending}>
              {createLink.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
    </SheetDialog>
  );
}
