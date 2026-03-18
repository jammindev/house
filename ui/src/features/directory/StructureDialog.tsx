import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Label } from '@/design-system/label';
import { createStructure, updateStructure, type Structure } from '@/lib/api/structures';

const STRUCTURE_TYPES = ['company', 'association', 'administration', 'artisan', 'other'];

interface StructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingStructure?: Structure;
}

export default function StructureDialog({
  open,
  onOpenChange,
  onSaved,
  existingStructure,
}: StructureDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingStructure);

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existingStructure) {
      setName(existingStructure.name ?? '');
      setType(existingStructure.type ?? '');
      setWebsite(existingStructure.website ?? '');
      setNotes(existingStructure.description ?? '');
    } else {
      setName('');
      setType('');
      setWebsite('');
      setNotes('');
    }
  }, [open, existingStructure?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('structures.nameRequired'));
      return;
    }
    setLoading(true);
    setError(null);

    const values = {
      name: name.trim(),
      type: type || undefined,
      website: website.trim() || undefined,
      description: notes.trim() || undefined,
    };

    const action = isEditing && existingStructure
      ? updateStructure(existingStructure.id, values, existingStructure)
      : createStructure(values);

    action
      .then(() => {
        setLoading(false);
        onOpenChange(false);
        onSaved();
      })
      .catch(() => {
        setLoading(false);
        setError(t('common.saveFailed'));
      });
  };

  const typeOptions = STRUCTURE_TYPES.map((s) => ({
    value: s,
    label: t(`structures.types.${s}`),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('structures.editTitle') : t('structures.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="structure-name">
              {t('structures.fieldName')} <span aria-hidden className="text-red-500">*</span>
            </Label>
            <Input
              id="structure-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <FormField label={t('structures.fieldType')} htmlFor="structure-type">
            <Select
              id="structure-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={typeOptions}
              placeholder={t('structures.noType')}
            />
          </FormField>

          <FormField label={t('structures.fieldWebsite')} htmlFor="structure-website">
            <Input
              id="structure-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </FormField>

          <FormField label={t('structures.fieldNotes')} htmlFor="structure-notes">
            <Textarea
              id="structure-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
