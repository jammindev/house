import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import {
  TREE_EVENT_TYPES,
  TREE_KINDS,
  type CareRule,
  type Tree,
  type TreeEventType,
  type TreeKind,
} from '@/lib/api/orchard';
import { useCreateCareRule, useUpdateCareRule } from './hooks';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type Scope = 'kind' | 'tree';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: CareRule;
  trees: Tree[];
}

export default function CareRuleDialog({ open, onOpenChange, existing, trees }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateCareRule();
  const updateMutation = useUpdateCareRule();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState('');
  const [startMonth, setStartMonth] = React.useState(11);
  const [endMonth, setEndMonth] = React.useState(3);
  const [eventType, setEventType] = React.useState<TreeEventType>('pruning');
  const [scope, setScope] = React.useState<Scope>('kind');
  const [kind, setKind] = React.useState<TreeKind>('fruit_tree');
  const [treeId, setTreeId] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setEmoji(existing.emoji);
      setStartMonth(existing.start_month);
      setEndMonth(existing.end_month);
      setEventType(existing.event_type);
      setScope(existing.tree ? 'tree' : 'kind');
      setKind((existing.kind || 'fruit_tree') as TreeKind);
      setTreeId(existing.tree ?? '');
      setNotes(existing.notes);
    } else {
      setName('');
      setEmoji('');
      // « Taille d'hiver : novembre → mars » — la fenêtre à cheval sur deux
      // années est le cas normal d'un verger, donc c'est le défaut proposé.
      setStartMonth(11);
      setEndMonth(3);
      setEventType('pruning');
      setScope('kind');
      setKind('fruit_tree');
      setTreeId(trees[0]?.id ?? '');
      setNotes('');
    }
  }, [open, existing, trees]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      emoji: emoji.trim(),
      start_month: startMonth,
      end_month: endMonth,
      event_type: eventType,
      // One scope or the other, never both — a rule that is two rules at once
      // cannot be satisfied by one journal entry.
      tree: scope === 'tree' ? treeId : null,
      kind: scope === 'kind' ? kind : ('' as const),
      notes: notes.trim(),
    };
    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
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
      title={isEditing ? t('orchard.care.editTitle') : t('orchard.care.newTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_6rem]">
          <FormField label={`${t('orchard.fields.name')} *`} htmlFor="rule-name">
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </FormField>
          <FormField label={t('orchard.fields.emoji')} htmlFor="rule-emoji">
            <Input id="rule-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={`${t('orchard.care.windowStart')} *`} htmlFor="rule-start">
            <Select
              id="rule-start"
              value={String(startMonth)}
              onChange={(e) => setStartMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {t(`orchard.months.${m}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={`${t('orchard.care.windowEnd')} *`} htmlFor="rule-end">
            <Select
              id="rule-end"
              value={String(endMonth)}
              onChange={(e) => setEndMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {t(`orchard.months.${m}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <p className="text-xs text-muted-foreground">{t('orchard.care.windowHint')}</p>

        <FormField label={t('orchard.care.eventType')} htmlFor="rule-event-type">
          <Select
            id="rule-event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as TreeEventType)}
          >
            {TREE_EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`orchard.eventType.${value}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('orchard.care.scope')} htmlFor="rule-scope">
          <Select
            id="rule-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="kind">{t('orchard.care.scopeKind')}</option>
            <option value="tree">{t('orchard.care.scopeTree')}</option>
          </Select>
        </FormField>

        {scope === 'kind' ? (
          <FormField label={t('orchard.fields.kind')} htmlFor="rule-kind">
            <Select
              id="rule-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as TreeKind)}
            >
              {TREE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`orchard.kind.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
        ) : (
          <FormField label={t('orchard.fields.tree')} htmlFor="rule-tree">
            <Select id="rule-tree" value={treeId} onChange={(e) => setTreeId(e.target.value)}>
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>
                  {tree.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label={t('orchard.fields.notes')} htmlFor="rule-notes">
          <Textarea
            id="rule-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
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
