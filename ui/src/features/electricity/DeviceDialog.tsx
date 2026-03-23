import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { CheckboxField } from '@/design-system/checkbox-field';
import { useCreateDevice, useUpdateDevice } from './hooks';
import type { ProtectiveDevice, DeviceType, PhaseType, CurveType, RcdTypeCode, DeviceRole } from '@/lib/api/electricity';

interface DeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  supplyType: 'single_phase' | 'three_phase';
  existing?: ProtectiveDevice;
}

export default function DeviceDialog({
  open,
  onOpenChange,
  boardId,
  supplyType,
  existing,
}: DeviceDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [deviceType, setDeviceType] = React.useState<DeviceType>('breaker');
  const [label, setLabel] = React.useState('');
  const [role, setRole] = React.useState<DeviceRole | ''>('divisionary');
  const [ratingAmps, setRatingAmps] = React.useState('20');
  const [curveType, setCurveType] = React.useState<CurveType | ''>('c');
  const [sensitivityMa, setSensitivityMa] = React.useState('30');
  const [typeCode, setTypeCode] = React.useState<RcdTypeCode | ''>('a');
  const [phase, setPhase] = React.useState<PhaseType | ''>('');
  const [brand, setBrand] = React.useState('');
  const [modelRef, setModelRef] = React.useState('');
  const [isSpare, setIsSpare] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const isPending = createDevice.isPending || updateDevice.isPending;

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setDeviceType(existing.device_type);
      setLabel(existing.label ?? '');
      setRole((existing.role as DeviceRole | '') ?? '');
      setRatingAmps(existing.rating_amps != null ? String(existing.rating_amps) : '20');
      setCurveType((existing.curve_type as CurveType | '') ?? 'c');
      setSensitivityMa(existing.sensitivity_ma != null ? String(existing.sensitivity_ma) : '30');
      setTypeCode((existing.type_code as RcdTypeCode | '') ?? 'a');
      setPhase((existing.phase as PhaseType | '') ?? '');
      setBrand(existing.brand ?? '');
      setModelRef(existing.model_ref ?? '');
      setIsSpare(existing.is_spare ?? false);
      setNotes(existing.notes ?? '');
    } else {
      setDeviceType('breaker');
      setLabel('');
      setRole('divisionary');
      setRatingAmps('20');
      setCurveType('c');
      setSensitivityMa('30');
      setTypeCode('a');
      setPhase('');
      setBrand('');
      setModelRef('');
      setIsSpare(false);
      setNotes('');
    }
    setError(null);
  }, [open, existing]);

  const isBreaker = deviceType === 'breaker';
  const isRcd = deviceType === 'rcd';
  const isCombined = deviceType === 'combined';
  const isThreePhase = supplyType === 'three_phase';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      board: boardId,
      device_type: deviceType,
      label: label.trim() || undefined,
      role: (role as DeviceRole) || undefined,
      rating_amps: isBreaker || isCombined ? Number(ratingAmps) || null : null,
      curve_type: isBreaker || isCombined ? (curveType as CurveType) : ('' as const),
      sensitivity_ma: isRcd || isCombined ? Number(sensitivityMa) || null : null,
      type_code: isRcd || isCombined ? (typeCode as RcdTypeCode) : ('' as const),
      phase: isThreePhase ? (phase as PhaseType) || null : null,
      brand: brand.trim(),
      model_ref: modelRef.trim(),
      is_spare: isSpare,
      notes: notes.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateDevice.mutateAsync({ id: existing.id, payload });
      } else {
        await createDevice.mutateAsync(payload);
      }
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

  const deviceTypeOptions = [
    { value: 'breaker', label: t('electricity.device.typeBreaker') },
    { value: 'rcd', label: t('electricity.device.typeRcd') },
    { value: 'combined', label: t('electricity.device.typeCombined') },
    { value: 'main', label: t('electricity.device.typeMain') },
  ];

  const roleOptions = [
    { value: '', label: '—' },
    { value: 'main', label: t('electricity.device.roleMain') },
    { value: 'divisionary', label: t('electricity.device.roleDivisionary') },
    { value: 'spare', label: t('electricity.device.roleSpare') },
  ];

  const curveOptions = [
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
    { value: 'd', label: 'D' },
    { value: 'other', label: t('electricity.device.curveOther') },
  ];

  const typeCodeOptions = [
    { value: 'ac', label: 'AC' },
    { value: 'a', label: 'A' },
    { value: 'f', label: 'F' },
    { value: 'b', label: 'B' },
    { value: 'other', label: t('electricity.device.typeCodeOther') },
  ];

  const phaseOptions = [
    { value: '', label: t('electricity.phaseNone') },
    { value: 'L1', label: 'L1' },
    { value: 'L2', label: 'L2' },
    { value: 'L3', label: 'L3' },
  ];

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('electricity.device.edit') : t('electricity.device.new')}
    >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <FormField label={t('electricity.device.type')} htmlFor="dev-type">
            <Select
              id="dev-type"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as DeviceType)}
              options={deviceTypeOptions}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('electricity.device.label')} htmlFor="dev-label">
              <Input
                id="dev-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="BRK-01"
              />
            </FormField>

            <FormField label={t('electricity.device.role')} htmlFor="dev-role">
              <Select
                id="dev-role"
                value={role}
                onChange={(e) => setRole(e.target.value as DeviceRole | '')}
                options={roleOptions}
              />
            </FormField>
          </div>

          {(isBreaker || isCombined) && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('electricity.device.ratingAmps')} htmlFor="dev-rating">
                <Input
                  id="dev-rating"
                  type="number"
                  min={1}
                  value={ratingAmps}
                  onChange={(e) => setRatingAmps(e.target.value)}
                />
              </FormField>
              <FormField label={t('electricity.device.curve')} htmlFor="dev-curve">
                <Select
                  id="dev-curve"
                  value={curveType}
                  onChange={(e) => setCurveType(e.target.value as CurveType | '')}
                  options={curveOptions}
                />
              </FormField>
            </div>
          )}

          {(isRcd || isCombined) && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('electricity.device.sensitivityMa')} htmlFor="dev-sensitivity">
                <Select
                  id="dev-sensitivity"
                  value={sensitivityMa}
                  onChange={(e) => setSensitivityMa(e.target.value)}
                  options={[
                    { value: '10', label: '10 mA' },
                    { value: '30', label: '30 mA' },
                    { value: '100', label: '100 mA' },
                    { value: '300', label: '300 mA' },
                    { value: '500', label: '500 mA' },
                  ]}
                />
              </FormField>
              <FormField label={t('electricity.device.typeCode')} htmlFor="dev-typecode">
                <Select
                  id="dev-typecode"
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value as RcdTypeCode | '')}
                  options={typeCodeOptions}
                />
              </FormField>
            </div>
          )}

          {isThreePhase && (
            <FormField label={t('electricity.device.phase')} htmlFor="dev-phase">
              <Select
                id="dev-phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value as PhaseType | '')}
                options={phaseOptions}
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('electricity.device.brand')} htmlFor="dev-brand">
              <Input
                id="dev-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Schneider, Legrand…"
              />
            </FormField>
            <FormField label={t('electricity.device.modelRef')} htmlFor="dev-model">
              <Input
                id="dev-model"
                value={modelRef}
                onChange={(e) => setModelRef(e.target.value)}
              />
            </FormField>
          </div>

          <CheckboxField
            id="dev-spare"
            label={t('electricity.device.isSpare')}
            checked={isSpare}
            onChange={setIsSpare}
          />

          <FormField label={t('electricity.device.notes')} htmlFor="dev-notes">
            <Textarea
              id="dev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </FormField>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
    </SheetDialog>
  );
}
