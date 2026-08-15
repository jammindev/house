import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import { todayISO } from '@/lib/format';
import {
  TREE_EVENT_TYPES,
  type Tree,
  type TreeEvent,
  type TreeEventType,
} from '@/lib/api/orchard';
import { useCreateTreeEvent, useUpdateTreeEvent } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: TreeEvent;
  /** Subjects to pick from; a single one means the field is fixed. */
  trees: Tree[];
  defaultTreeId?: string;
}

export default function TreeEventDialog({
  open,
  onOpenChange,
  existing,
  trees,
  defaultTreeId,
}: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateTreeEvent();
  const updateMutation = useUpdateTreeEvent();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [treeId, setTreeId] = React.useState('');
  const [type, setType] = React.useState<TreeEventType>('pruning');
  // todayISO, never toISOString(): the latter converts to UTC first and dates
  // everything between midnight and 2 a.m. as yesterday.
  const [occurredOn, setOccurredOn] = React.useState(todayISO());
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setTreeId(existing.tree);
      setType(existing.type);
      setOccurredOn(existing.occurred_on);
      setTitle(existing.title);
      setNotes(existing.notes);
    } else {
      setTreeId(defaultTreeId ?? trees[0]?.id ?? '');
      setType('pruning');
      setOccurredOn(todayISO());
      setTitle('');
      setNotes('');
    }
  }, [open, existing, defaultTreeId, trees]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!treeId) return;

    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          payload: { type, occurred_on: occurredOn, title: title.trim(), notes: notes.trim() },
        });
      } else {
        await createMutation.mutateAsync({
          tree: treeId,
          type,
          occurred_on: occurredOn,
          title: title.trim(),
          notes: notes.trim(),
        });
      }
      onOpenChange(false);
    } catch {
      // toast handled by the mutation hooks
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('orchard.event.editTitle') : t('orchard.event.newTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && !defaultTreeId ? (
          <FormField label={`${t('orchard.fields.tree')} *`} htmlFor="event-tree">
            <Select id="event-tree" value={treeId} onChange={(e) => setTreeId(e.target.value)}>
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>
                  {tree.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={`${t('orchard.fields.eventType')} *`} htmlFor="event-type">
            <Select
              id="event-type"
              value={type}
              onChange={(e) => setType(e.target.value as TreeEventType)}
            >
              {TREE_EVENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`orchard.eventType.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={`${t('orchard.fields.occurredOn')} *`} htmlFor="event-date">
            <Input
              id="event-date"
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
            />
          </FormField>
        </div>

        <FormField label={`${t('orchard.fields.title')} *`} htmlFor="event-title">
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </FormField>

        <FormField label={t('orchard.fields.notes')} htmlFor="event-notes">
          <Textarea
            id="event-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
