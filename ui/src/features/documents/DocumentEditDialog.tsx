import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { DOCUMENT_TYPES, type DocumentItem } from '@/lib/api/documents';
import { useUpdateDocument } from './hooks';

interface DocumentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocumentItem | null;
  onSaved: () => void;
}

export default function DocumentEditDialog({
  open,
  onOpenChange,
  doc,
  onSaved,
}: DocumentEditDialogProps) {
  const { t } = useTranslation();
  const updateDocument = useUpdateDocument();

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('document');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !doc) return;
    setName(doc.name || '');
    setType(doc.type || 'document');
    setNotes(doc.notes || '');
    setError(null);
  }, [open, doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc) return;
    setError(null);
    updateDocument.mutate(
      { id: doc.id, payload: { name, type, notes } },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
        },
        onError: () => {
          setError(t('documents.editFailed'));
        },
      },
    );
  };

  const typeOptions = DOCUMENT_TYPES.map((v) => ({
    value: v,
    label: t(`documents.type.${v}`, { defaultValue: v }),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('documents.editTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Name */}
          <FormField label={t('documents.fieldName')} htmlFor="edit-doc-name">
            <Input
              id="edit-doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </FormField>

          {/* Type */}
          <FormField label={t('documents.fieldType')} htmlFor="edit-doc-type">
            <Select
              id="edit-doc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={typeOptions}
            />
          </FormField>

          {/* Notes */}
          <FormField label={t('documents.fieldNotes')} htmlFor="edit-doc-notes">
            <Textarea
              id="edit-doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('documents.fieldNotesPlaceholder')}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateDocument.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateDocument.isPending}>
              {updateDocument.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
