import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import type { Briefing } from '@/lib/api/briefings';
import { useCreateBriefing, useUpdateBriefing } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Briefing;
}

export default function BriefingDialog({ open, onOpenChange, existing }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateBriefing();
  const updateMutation = useUpdateBriefing();

  const [title, setTitle] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [condition, setCondition] = React.useState('');
  const [visibility, setVisibility] = React.useState<'shared' | 'private'>('shared');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setPrompt(existing.prompt);
      setCondition(existing.condition || '');
      setVisibility(existing.is_private ? 'private' : 'shared');
    } else {
      setTitle('');
      setPrompt('');
      setCondition('');
      setVisibility('shared');
    }
  }, [open, existing]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;
    const payload = {
      title: title.trim(),
      prompt: prompt.trim(),
      condition: condition.trim(),
      is_private: visibility === 'private',
    };
    if (existing) {
      await updateMutation.mutateAsync({ id: existing.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('briefings.edit.title') : t('briefings.new.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={`${t('briefings.fields.title')} *`} htmlFor="briefing-title">
          <Input
            id="briefing-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('briefings.fields.titlePlaceholder')}
            required
            autoComplete="off"
          />
        </FormField>

        <FormField label={`${t('briefings.fields.prompt')} *`} htmlFor="briefing-prompt">
          <Textarea
            id="briefing-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('briefings.fields.promptPlaceholder')}
            required
          />
          <p className="text-xs text-muted-foreground">{t('briefings.fields.promptHint')}</p>
        </FormField>

        <FormField label={t('briefings.fields.condition')} htmlFor="briefing-condition">
          <Textarea
            id="briefing-condition"
            rows={2}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder={t('briefings.fields.conditionPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('briefings.fields.conditionHint')}</p>
        </FormField>

        <FormField label={t('briefings.fields.visibility')} htmlFor="briefing-visibility">
          <Select
            id="briefing-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'shared' | 'private')}
            options={[
              { value: 'shared', label: t('briefings.visibility.sharedHint') },
              { value: 'private', label: t('briefings.visibility.privateHint') },
            ]}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
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
