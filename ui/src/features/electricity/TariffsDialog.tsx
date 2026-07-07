import * as React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Card } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import CardActions, { type CardAction } from '@/components/CardActions';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import type { ElectricityMeter, MeterTariff } from '@/lib/api/electricity';
import {
  consumptionKeys,
  useCreateMeterTariff,
  useDeleteMeterTariff,
  useMeterTariffs,
  useUpdateMeterTariff,
} from './hooks';

interface TariffsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: ElectricityMeter;
}

function formatPrice(value: string | null, locale: string): string {
  if (value === null) return '—';
  return `${Number(value).toLocaleString(locale, { maximumFractionDigits: 5 })} €/kWh`;
}

// view: 'list' | tariff being edited | null for a new tariff
type FormTarget = MeterTariff | null;

export default function TariffsDialog({ open, onOpenChange, meter }: TariffsDialogProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const qc = useQueryClient();
  const isHpHc = meter.tariff_type === 'hp_hc';

  const { data: tariffs = [] } = useMeterTariffs(open ? meter.id : undefined);
  const [formTarget, setFormTarget] = React.useState<FormTarget | undefined>(undefined);

  const [validFrom, setValidFrom] = React.useState('');
  const [priceBase, setPriceBase] = React.useState('');
  const [priceHp, setPriceHp] = React.useState('');
  const [priceHc, setPriceHc] = React.useState('');
  const [subscription, setSubscription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createTariff = useCreateMeterTariff();
  const updateTariff = useUpdateMeterTariff();
  const deleteTariff = useDeleteMeterTariff();
  const isPending = createTariff.isPending || updateTariff.isPending;

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('electricity.tariff.deleted'),
    onDelete: (id: string) => deleteTariff.mutateAsync(id),
  });

  React.useEffect(() => {
    if (!open) return;
    setFormTarget(undefined);
    setError(null);
  }, [open]);

  function openForm(target: FormTarget) {
    if (target) {
      setValidFrom(target.valid_from);
      setPriceBase(target.price_base ?? '');
      setPriceHp(target.price_hp ?? '');
      setPriceHc(target.price_hc ?? '');
      setSubscription(target.subscription_eur_month ?? '');
    } else {
      setValidFrom(new Date().toISOString().slice(0, 10));
      setPriceBase('');
      setPriceHp('');
      setPriceHc('');
      setSubscription('');
    }
    setError(null);
    setFormTarget(target);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      meter: meter.id,
      valid_from: validFrom,
      price_base: isHpHc ? null : priceBase.trim() || null,
      price_hp: isHpHc ? priceHp.trim() || null : null,
      price_hc: isHpHc ? priceHc.trim() || null : null,
      subscription_eur_month: subscription.trim() || null,
    };

    try {
      if (formTarget) {
        await updateTariff.mutateAsync({ id: formTarget.id, payload });
      } else {
        await createTariff.mutateAsync(payload);
      }
      setFormTarget(undefined);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const first = data ? Object.values(data).flat()[0] : null;
      setError(first ?? t('common.saveFailed'));
    }
  }

  const inForm = formTarget !== undefined;

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        inForm
          ? formTarget
            ? t('electricity.tariff.edit')
            : t('electricity.tariff.new')
          : t('electricity.tariff.title', { meter: meter.name })
      }
    >
      {inForm ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <FormField label={t('electricity.tariff.validFrom')} htmlFor="tariff-valid-from">
            <Input
              id="tariff-valid-from"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              required
            />
          </FormField>
          {isHpHc ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('electricity.tariff.priceHp')} htmlFor="tariff-price-hp">
                <Input
                  id="tariff-price-hp"
                  type="number"
                  step="0.00001"
                  min="0"
                  inputMode="decimal"
                  value={priceHp}
                  onChange={(e) => setPriceHp(e.target.value)}
                  placeholder="0.27"
                  required
                />
              </FormField>
              <FormField label={t('electricity.tariff.priceHc')} htmlFor="tariff-price-hc">
                <Input
                  id="tariff-price-hc"
                  type="number"
                  step="0.00001"
                  min="0"
                  inputMode="decimal"
                  value={priceHc}
                  onChange={(e) => setPriceHc(e.target.value)}
                  placeholder="0.2068"
                  required
                />
              </FormField>
            </div>
          ) : (
            <FormField label={t('electricity.tariff.priceBase')} htmlFor="tariff-price-base">
              <Input
                id="tariff-price-base"
                type="number"
                step="0.00001"
                min="0"
                inputMode="decimal"
                value={priceBase}
                onChange={(e) => setPriceBase(e.target.value)}
                placeholder="0.2516"
                required
              />
            </FormField>
          )}
          <FormField label={t('electricity.tariff.subscription')} htmlFor="tariff-subscription">
            <Input
              id="tariff-subscription"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={subscription}
              onChange={(e) => setSubscription(e.target.value)}
              placeholder="12.44"
            />
          </FormField>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormTarget(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {tariffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('electricity.tariff.empty')}</p>
          ) : (
            <div className="space-y-2">
              {tariffs.map((tariff) => {
                const actions: CardAction[] = [
                  { label: t('common.edit'), icon: Pencil, onClick: () => openForm(tariff) },
                  {
                    label: t('common.delete'),
                    icon: Trash2,
                    variant: 'danger',
                    onClick: () =>
                      deleteWithUndo(tariff.id, {
                        onRemove: () => qc.setQueryData<MeterTariff[]>(
                          consumptionKeys.tariffs(meter.id),
                          (old) => old?.filter((item) => item.id !== tariff.id),
                        ),
                        onRestore: () => qc.setQueryData<MeterTariff[]>(
                          consumptionKeys.tariffs(meter.id),
                          (old) => (old ? [...old, tariff] : [tariff]),
                        ),
                      }),
                  },
                ];
                return (
                  <Card key={tariff.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                        <p className="font-medium">
                          {t('electricity.tariff.since', {
                            date: new Date(`${tariff.valid_from}T00:00:00`).toLocaleDateString(locale),
                          })}
                        </p>
                        <p className="text-muted-foreground">
                          {isHpHc
                            ? `HP ${formatPrice(tariff.price_hp, locale)} · HC ${formatPrice(tariff.price_hc, locale)}`
                            : formatPrice(tariff.price_base, locale)}
                        </p>
                        {tariff.subscription_eur_month !== null ? (
                          <p className="text-muted-foreground">
                            {t('electricity.tariff.subscriptionValue', {
                              amount: Number(tariff.subscription_eur_month).toLocaleString(locale, {
                                style: 'currency',
                                currency: 'EUR',
                              }),
                            })}
                          </p>
                        ) : null}
                      </div>
                      <CardActions actions={actions} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openForm(null)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('electricity.tariff.new')}
            </Button>
          </div>
        </div>
      )}
    </SheetDialog>
  );
}
