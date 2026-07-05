import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { formatTrackerValue, type Tracker } from '@/lib/api/trackers';
import { useUpdateTracker } from './hooks';

interface RefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracker: Tracker;
}

/**
 * "Réapprovisionner" — add a quantity to a consumption tracker's reserve.
 * The API takes the new total; the addition happens here.
 */
export default function RefillDialog({ open, onOpenChange, tracker }: RefillDialogProps) {
  const { t } = useTranslation();
  const [added, setAdded] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const updateTracker = useUpdateTracker();

  React.useEffect(() => {
    if (!open) return;
    setAdded('');
    setError(null);
  }, [open]);

  const current = tracker.reserve != null ? Number(tracker.reserve) : 0;
  const addedNumber = Number(added.trim().replace(',', '.'));
  const newTotal = !added.trim() || Number.isNaN(addedNumber) ? null : current + addedNumber;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newTotal == null) {
      setError(t('trackers.reserveInvalid'));
      return;
    }
    try {
      await updateTracker.mutateAsync({
        id: tracker.id,
        payload: { reserve: String(newTotal) },
      });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('trackers.refillTitle')} size="s">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FormField
          label={
            tracker.unit
              ? `${t('trackers.refillAdded')} (${tracker.unit})`
              : t('trackers.refillAdded')
          }
          htmlFor="refill-added"
        >
          <Input
            id="refill-added"
            type="text"
            inputMode="decimal"
            value={added}
            onChange={(e) => setAdded(e.target.value)}
            autoFocus
            required
          />
        </FormField>

        <p className="text-xs text-muted-foreground">
          {t('trackers.refillCurrent', {
            value: tracker.reserve != null ? formatTrackerValue(tracker.reserve) : '0',
            unit: tracker.unit,
          })}
          {newTotal != null ? (
            <>
              {' · '}
              <span className="font-medium text-foreground">
                {t('trackers.refillNewTotal', {
                  value: formatTrackerValue(String(newTotal)),
                  unit: tracker.unit,
                })}
              </span>
            </>
          ) : null}
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={updateTracker.isPending}>
            {t('trackers.refillConfirm')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
