import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import { ZoneMultiSelect } from '@/components/ZoneMultiSelect';
import type { AllocationLine } from '@/lib/api/banking';
import { useBudgets } from '@/features/budget/hooks';
import { useAllocations, useSetAllocations } from './hooks';
import AllocationSourceSelect from './AllocationSourceSelect';
import { NO_SOURCE, type AllocationSource } from './allocationSource';

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Id seul, pas l'objet : le dialog charge déjà la ventilation courante, qui
   * embarque la ligne. Passer l'objet en plus obligerait chaque appelant à le
   * détenir — or la file de rangement (parcours 26) ne connaît que des écarts,
   * identifiés par un id.
   */
  transactionId: string;
}

interface DraftLine {
  key: string;
  subject: string;
  amount: string;
  budgetId: string;
  /** Axe « objet » (projet / équipement / stock) — indépendant du budget. */
  source: AllocationSource;
  zoneIds: string[];
}

let lineCounter = 0;
function blankLine(
  subject = '',
  amount = '',
  budgetId = '',
  source: AllocationSource = NO_SOURCE,
  zoneIds: string[] = [],
): DraftLine {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, subject, amount, budgetId, source, zoneIds };
}

/**
 * Ventile une opération en un ou plusieurs postes.
 *
 * Chaque ligne devient une dépense du journal, avec son propre budget — c'est
 * précisément ce qui permet à 120 € au supermarché d'être 80 € de courses et
 * 40 € de bricolage. L'enregistrement est un **remplacement complet** : on
 * envoie la ventilation voulue, pas une suite de modifications.
 */
export default function AllocationDialog({
  open,
  onOpenChange,
  transactionId,
}: AllocationDialogProps) {
  const { t } = useTranslation();
  const allocationsQuery = useAllocations(open ? transactionId : undefined);
  const budgetsQuery = useBudgets();
  const mutation = useSetAllocations();

  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const transaction = allocationsQuery.data?.transaction;
  const label = transaction?.label_raw ?? '';
  const total = Math.abs(Number(transaction?.amount ?? 0));

  React.useEffect(() => {
    if (!open || !allocationsQuery.data) return;
    setError(null);
    const existing = allocationsQuery.data.allocations;
    setLines(
      existing.length > 0
        ? existing.map((a) =>
            blankLine(
              a.subject,
              a.amount ?? '',
              a.budget?.id ?? '',
              a.source_type && a.source_id
                ? { type: a.source_type as AllocationSource['type'], id: a.source_id }
                : NO_SOURCE,
              a.zone_ids ?? [],
            ),
          )
        : // Première ventilation : on pré-remplit une ligne au montant total,
          // le cas le plus fréquent (une opération = un poste).
          [blankLine(label, total.toFixed(2), '')],
    );
  }, [open, allocationsQuery.data, label, total]);

  const allocated = lines.reduce((sum, line) => {
    const value = Number(line.amount.replace(',', '.'));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const remaining = total - allocated;

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine('', remaining > 0 ? remaining.toFixed(2) : '', '')]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: AllocationLine[] = [];
    for (const line of lines) {
      const value = Number(line.amount.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) {
        setError(t('banking.allocation.errors.amountInvalid'));
        return;
      }
      // Un type de source sans objet choisi est une ligne à moitié remplie : le
      // serveur la refuserait, autant le dire ici et nommer la ligne.
      if (line.source.type && !line.source.id) {
        setError(t('banking.allocation.errors.sourceIncomplete'));
        return;
      }
      payload.push({
        subject: line.subject.trim() || label,
        amount: value.toFixed(2),
        budget_id: line.budgetId || null,
        source_type: line.source.type || null,
        source_id: line.source.id || null,
        zone_ids: line.zoneIds,
      });
    }

    if (allocated > total + 0.001) {
      setError(t('banking.allocation.errors.overAllocated', { total: formatAmount(String(total)) }));
      return;
    }

    try {
      await mutation.mutateAsync({ transactionId, lines: payload });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const budgetOptions = [
    { value: '', label: t('banking.allocation.noBudget') },
    ...(budgetsQuery.data ?? [])
      .filter((b) => !b.is_global)
      .map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.allocation.title')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{label}</p>
          {transaction ? (
            <p className="text-xs text-muted-foreground">
              {new Date(transaction.booked_on).toLocaleDateString()} ·{' '}
              {formatAmount(transaction.amount)}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('banking.allocation.line', { n: index + 1 })}
                </span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('banking.allocation.removeLine')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <FormField label={t('banking.allocation.fields.subject')} htmlFor={`s-${line.key}`}>
                  <Input
                    id={`s-${line.key}`}
                    value={line.subject}
                    onChange={(e) => update(line.key, { subject: e.target.value })}
                    placeholder={label}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    label={t('banking.allocation.fields.amount')}
                    htmlFor={`a-${line.key}`}
                  >
                    <Input
                      id={`a-${line.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) => update(line.key, { amount: e.target.value })}
                    />
                  </FormField>

                  <FormField
                    label={t('banking.allocation.fields.budget')}
                    htmlFor={`b-${line.key}`}
                  >
                    <Select
                      id={`b-${line.key}`}
                      value={line.budgetId}
                      onChange={(e) => update(line.key, { budgetId: e.target.value })}
                      options={budgetOptions}
                    />
                  </FormField>
                </div>

                {/* Axe « objet », indépendant du budget : ces 90 € comptent dans le
                    chantier *et* dans l'enveloppe. */}
                <FormField
                  label={t('banking.allocation.fields.attachTo')}
                  htmlFor={`src-${line.key}-source-type`}
                >
                  <AllocationSourceSelect
                    idPrefix={`src-${line.key}`}
                    value={line.source}
                    onChange={(source) => update(line.key, { source })}
                  />
                </FormField>

                <FormField
                  label={t('banking.allocation.fields.zones')}
                  htmlFor={`z-${line.key}`}
                >
                  <ZoneMultiSelect
                    id={`z-${line.key}`}
                    value={line.zoneIds}
                    onChange={(zoneIds) => update(line.key, { zoneIds })}
                    maxHeightClass="max-h-32"
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          {t('banking.allocation.addLine')}
        </Button>

        <div
          className={`rounded-lg border p-3 text-sm ${
            remaining < -0.001
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/40 text-foreground'
          }`}
        >
          <div className="flex justify-between">
            <span>{t('banking.allocation.allocated')}</span>
            <span className="font-semibold tabular-nums">{formatAmount(allocated.toFixed(2))}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>{t('banking.allocation.remaining')}</span>
            <span className="font-semibold tabular-nums">{formatAmount(remaining.toFixed(2))}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending || !transaction}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
