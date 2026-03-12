import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import type { DocumentItem } from '@/lib/api/documents';
import { updateDocument, DOCUMENT_TYPES } from '@/lib/api/documents';

interface EditDocumentModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: DocumentItem) => void;
}

export default function EditDocumentModal({
  document,
  isOpen,
  onClose,
  onSuccess,
}: EditDocumentModalProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [type, setType] = React.useState('document');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (document) {
      setName(document.name || '');
      setNotes(document.notes || '');
      setType(document.type || 'document');
      setError(null);
    }
  }, [document]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;
    setLoading(true);
    setError(null);
    updateDocument(document.id, { name, notes, type })
      .then((updated) => {
        setLoading(false);
        onSuccess(updated);
        handleClose();
      })
      .catch(() => {
        setLoading(false);
        setError(t('documents.editFailed', { defaultValue: 'Failed to save changes.' }));
      });
  };

  const typeOptions = DOCUMENT_TYPES.map((v) => ({
    value: v,
    label: t(`documents.type.${v}`, { defaultValue: v }),
  }));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('documents.editModalTitle', { defaultValue: 'Edit document' })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="edit-doc-name">
              {t('documents.fieldName', { defaultValue: 'Name' })}
            </label>
            <Input
              id="edit-doc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="edit-doc-type">
              {t('documents.fieldType', { defaultValue: 'Type' })}
            </label>
            <Select
              id="edit-doc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={typeOptions}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="edit-doc-notes">
              {t('documents.fieldNotes', { defaultValue: 'Notes' })}
            </label>
            <Textarea
              id="edit-doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('documents.fieldNotesPlaceholder', { defaultValue: 'Optional notes…' })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? t('common.saving', { defaultValue: 'Saving…' })
                : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
