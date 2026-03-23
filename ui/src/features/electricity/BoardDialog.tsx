import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { fetchZones } from '@/lib/api/zones';
import type { Zone } from '@/lib/api/zones';
import { useCreateBoard, useUpdateBoard } from './hooks';
import type { ElectricityBoard } from '@/lib/api/electricity';

interface BoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ElectricityBoard;
}

export default function BoardDialog({ open, onOpenChange, existing }: BoardDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [name, setName] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');
  const [supplyType, setSupplyType] = React.useState<'single_phase' | 'three_phase'>('single_phase');
  const [location, setLocation] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lastInspection, setLastInspection] = React.useState('');
  const [compliance, setCompliance] = React.useState<'' | 'yes' | 'no' | 'partial'>('');
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const isPending = createBoard.isPending || updateBoard.isPending;

  React.useEffect(() => {
    if (!open) return;
    fetchZones().then(setZones).catch(() => setZones([]));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name ?? '');
      setZoneId(existing.zone ?? '');
      setSupplyType((existing.supply_type as 'single_phase' | 'three_phase') ?? 'single_phase');
      setLocation(existing.location ?? '');
      setNotes(existing.main_notes ?? '');
      setLastInspection(existing.last_inspection_date ?? '');
      setCompliance((existing.nf_c_15100_compliant as '' | 'yes' | 'no' | 'partial') ?? '');
    } else {
      setName(t('electricity.board.defaultName'));
      setZoneId('');
      setSupplyType('single_phase');
      setLocation('');
      setNotes('');
      setLastInspection('');
      setCompliance('');
    }
    setError(null);
  }, [open, existing, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError(t('electricity.board.nameRequired')); return; }
    if (!zoneId) { setError(t('electricity.board.zoneRequired')); return; }

    const payload = {
      name: name.trim(),
      zone: zoneId,
      supply_type: supplyType,
      location: location.trim(),
      main_notes: notes.trim(),
      last_inspection_date: lastInspection || null,
      nf_c_15100_compliant: (compliance || null) as 'yes' | 'no' | 'partial' | null,
    };

    try {
      if (isEditing && existing) {
        await updateBoard.mutateAsync({ id: existing.id, payload });
      } else {
        await createBoard.mutateAsync({ ...payload, supply_type: supplyType });
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

  const supplyOptions = [
    { value: 'single_phase', label: t('electricity.board.supplySingle') },
    { value: 'three_phase', label: t('electricity.board.supplyThree') },
  ];

  const complianceOptions = [
    { value: '', label: '—' },
    { value: 'yes', label: t('electricity.board.complianceYes') },
    { value: 'no', label: t('electricity.board.complianceNo') },
    { value: 'partial', label: t('electricity.board.compliancePartial') },
  ];

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.full_path ?? z.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('electricity.board.edit') : t('electricity.board.new')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-2">
          <FormField label={t('electricity.board.name')} htmlFor="board-name">
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label={t('electricity.board.zone')} htmlFor="board-zone">
            <Select
              id="board-zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              options={zoneOptions}
              placeholder={t('electricity.selectZone')}
              required
            />
          </FormField>

          <FormField label={t('electricity.board.supplyType')} htmlFor="board-supply">
            <Select
              id="board-supply"
              value={supplyType}
              onChange={(e) => setSupplyType(e.target.value as 'single_phase' | 'three_phase')}
              options={supplyOptions}
            />
          </FormField>

          <FormField label={t('electricity.board.location')} htmlFor="board-location">
            <Input
              id="board-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('electricity.board.locationPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('electricity.board.inspectionDate')} htmlFor="board-inspection">
              <Input
                id="board-inspection"
                type="date"
                value={lastInspection}
                onChange={(e) => setLastInspection(e.target.value)}
              />
            </FormField>

            <FormField label={t('electricity.board.compliance')} htmlFor="board-compliance">
              <Select
                id="board-compliance"
                value={compliance}
                onChange={(e) => setCompliance(e.target.value as '' | 'yes' | 'no' | 'partial')}
                options={complianceOptions}
              />
            </FormField>
          </div>

          <FormField label={t('electricity.board.notes')} htmlFor="board-notes">
            <Textarea
              id="board-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
