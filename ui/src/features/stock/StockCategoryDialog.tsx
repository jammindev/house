import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type { StockCategory } from '@/lib/api/stock';
import { useCreateCategory, useUpdateCategory } from './hooks';

interface StockCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingCategory?: StockCategory;
}

type FormState = {
  name: string;
  color: string;
  emoji: string;
};

const EMPTY_STATE: FormState = {
  name: '',
  color: '#94a3b8',
  emoji: '📦',
};

function fromApi(category: StockCategory): FormState {
  return {
    name: category.name || '',
    color: category.color || '#94a3b8',
    emoji: category.emoji || '📦',
  };
}

export default function StockCategoryDialog({
  open,
  onOpenChange,
  onSaved,
  existingCategory,
}: StockCategoryDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingCategory);

  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const isPending = createMutation.isPending || updateMutation.isPending;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existingCategory) {
      setForm(fromApi(existingCategory));
    } else {
      setForm(EMPTY_STATE);
    }
  }, [open, existingCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(t('stock.errors.name_required'));
      return;
    }

    const payload = {
      name: form.name.trim(),
      color: form.color.trim() || '#94a3b8',
      emoji: form.emoji.trim() || '📦',
    };

    try {
      if (isEditing && existingCategory) {
        await updateMutation.mutateAsync({ id: existingCategory.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError(t('stock.errors.create_failed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('stock.categories.edit_title') : t('stock.categories.create_title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <FormField label={`${t('stock.fields.name')} *`} htmlFor="cat-name">
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              autoComplete="off"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('stock.fields.emoji')} htmlFor="cat-emoji">
              <Input
                id="cat-emoji"
                value={form.emoji}
                onChange={(e) => updateField('emoji', e.target.value)}
              />
            </FormField>
            <FormField label={t('stock.fields.color')} htmlFor="cat-color">
              <Input
                id="cat-color"
                value={form.color}
                onChange={(e) => updateField('color', e.target.value)}
                placeholder="#94a3b8"
              />
            </FormField>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('stock.actions.saving')
                : isEditing
                  ? t('stock.actions.save')
                  : t('stock.actions.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
