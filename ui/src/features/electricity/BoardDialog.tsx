import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { fetchZones } from '@/lib/api/zones';
import type { Zone } from '@/lib/api/zones';
import { fetchBoards } from '@/lib/api/electricity';
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

  const [label, setLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [parentId, setParentId] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');
  const [supplyType, setSupplyType] = React.useState<'single_phase' | 'three_phase'>('single_phase');
  const [location, setLocation] = React.useState('');
  const [rows, setRows] = React.useState('');
  const [slotsPerRow, setSlotsPerRow] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lastInspection, setLastInspection] = React.useState('');
  const [compliance, setCompliance] = React.useState<'' | 'yes' | 'no' | 'partial'>('');
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [boards, setBoards] = React.useState<ElectricityBoard[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const isPending = createBoard.isPending || updateBoard.isPending;

  React.useEffect(() => {
    if (!open) return;
    fetchZones().then(setZones).catch(() => setZones([]));
    fetchBoards().then(setBoards).catch(() => setBoards([]));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setLabel(existing.label ?? '');
      setName(existing.name ?? '');
      setParentId(existing.parent ?? '');
      setZoneId(existing.zone ?? '');
      setSupplyType((existing.supply_type as 'single_phase' | 'three_phase') ?? 'single_phase');
      setLocation(existing.location ?? '');
      setRows(existing.rows != null ? String(existing.rows) : '');
      setSlotsPerRow(existing.slots_per_row != null ? String(existing.slots_per_row) : '');
      setNotes(existing.main_notes ?? '');
      setLastInspection(existing.last_inspection_date ?? '');
      setCompliance((existing.nf_c_15100_compliant as '' | 'yes' | 'no' | 'partial') ?? '');
    } else {
      setLabel('');
      setName(t('electricity.board.defaultName'));
      setParentId('');
      setZoneId('');
      setSupplyType('single_phase');
      setLocation('');
      setRows('');
      setSlotsPerRow('');
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
      label: label.trim() || undefined,
      name: name.trim(),
      parent: parentId || null,
      zone: zoneId,
      supply_type: supplyType,
      location: location.trim(),
      rows: rows !== '' ? parseInt(rows, 10) : null,
      slots_per_row: slotsPerRow !== '' ? parseInt(slotsPerRow, 10) : null,
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

  const parentOptions = [
    { value: '', label: t('electricity.board.parentNone') },
    ...boards
      .filter((b) => b.id !== existing?.id)
      .map((b) => ({ value: b.id, label: b.name })),
  ];

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
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('electricity.board.edit') : t('electricity.board.new')}
    >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('electricity.board.name')} htmlFor="board-name">
              <Input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>

            <FormField label={t('electricity.board.label')} htmlFor="board-label">
              <Input
                id="board-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('electricity.board.labelPlaceholder')}
              />
            </FormField>
          </div>

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

          <FormField label={t('electricity.board.parent')} htmlFor="board-parent">
            <Select
              id="board-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              options={parentOptions}
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
            <FormField label={t('electricity.board.rows')} htmlFor="board-rows">
              <Input
                id="board-rows"
                type="number"
                min={1}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
              />
            </FormField>

            <FormField label={t('electricity.board.slotsPerRow')} htmlFor="board-slots">
              <Input
                id="board-slots"
                type="number"
                min={1}
                value={slotsPerRow}
                onChange={(e) => setSlotsPerRow(e.target.value)}
              />
            </FormField>
          </div>

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
    </SheetDialog>
  );
}
