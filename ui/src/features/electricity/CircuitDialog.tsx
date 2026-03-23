import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { useCreateCircuit, useUpdateCircuit } from './hooks';
import type { ElectricCircuit, ProtectiveDevice, PhaseType } from '@/lib/api/electricity';

interface CircuitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  supplyType: 'single_phase' | 'three_phase';
  devices: ProtectiveDevice[];
  existing?: ElectricCircuit;
}

export default function CircuitDialog({
  open,
  onOpenChange,
  boardId,
  supplyType,
  devices,
  existing,
}: CircuitDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [label, setLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [breakerId, setBreakerId] = React.useState('');
  const [phase, setPhase] = React.useState<PhaseType | ''>('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createCircuit = useCreateCircuit();
  const updateCircuit = useUpdateCircuit();
  const isPending = createCircuit.isPending || updateCircuit.isPending;

  // Devices suitable as circuit breakers (breaker or combined)
  const eligibleDevices = devices.filter(
    (d) => d.is_active !== false && (d.device_type === 'breaker' || d.device_type === 'combined'),
  );

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setLabel(existing.label);
      setName(existing.name);
      setBreakerId(existing.breaker);
      setPhase((existing.phase as PhaseType | '') ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setLabel('');
      setName('');
      setBreakerId('');
      setPhase('');
      setNotes('');
    }
    setError(null);
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) { setError(t('electricity.circuit.labelRequired')); return; }
    if (!name.trim()) { setError(t('electricity.circuit.nameRequired')); return; }
    if (!breakerId) { setError(t('electricity.circuit.deviceRequired')); return; }
    if (supplyType === 'three_phase' && !phase) {
      setError(t('electricity.circuit.phaseRequired'));
      return;
    }

    const payload = {
      board: boardId,
      breaker: breakerId,
      label: label.trim(),
      name: name.trim(),
      phase: supplyType === 'three_phase' ? (phase as PhaseType) || null : null,
      notes: notes.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateCircuit.mutateAsync({ id: existing.id, payload });
      } else {
        await createCircuit.mutateAsync({ ...payload, is_active: true });
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

  const deviceOptions = eligibleDevices.map((d) => ({
    value: d.id,
    label: d.label ? `${d.label} — ${d.rating_amps ?? '?'}A` : `${d.rating_amps ?? '?'}A`,
  }));

  const phaseOptions = [
    { value: 'L1', label: 'L1' },
    { value: 'L2', label: 'L2' },
    { value: 'L3', label: 'L3' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('electricity.circuit.edit') : t('electricity.circuit.new')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('electricity.circuit.label')} htmlFor="cir-label">
              <Input
                id="cir-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="CIR-01"
                required
              />
            </FormField>
            <FormField label={t('electricity.circuit.name')} htmlFor="cir-name">
              <Input
                id="cir-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('electricity.circuit.namePlaceholder')}
                required
              />
            </FormField>
          </div>

          <FormField label={t('electricity.circuit.device')} htmlFor="cir-device">
            <Select
              id="cir-device"
              value={breakerId}
              onChange={(e) => setBreakerId(e.target.value)}
              options={deviceOptions}
              placeholder={t('electricity.selectDevice')}
              required
            />
          </FormField>

          {supplyType === 'three_phase' && (
            <FormField label={t('electricity.circuit.phase')} htmlFor="cir-phase">
              <Select
                id="cir-phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value as PhaseType | '')}
                options={phaseOptions}
                placeholder={t('electricity.phaseNone')}
                required
              />
            </FormField>
          )}

          <FormField label={t('electricity.circuit.notes')} htmlFor="cir-notes">
            <Textarea
              id="cir-notes"
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
      </DialogContent>
    </Dialog>
  );
}
