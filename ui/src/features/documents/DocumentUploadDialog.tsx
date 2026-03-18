import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Label } from '@/design-system/label';
import { fetchZones } from '@/lib/api/zones';
import { DOCUMENT_TYPES, type DocumentType } from '@/lib/api/documents';
import { useCreateDocument } from './hooks';

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function DocumentUploadDialog({
  open,
  onOpenChange,
  onSaved,
}: DocumentUploadDialogProps) {
  const { t } = useTranslation();
  const createDocument = useCreateDocument();

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<DocumentType | ''>('');
  const [notes, setNotes] = React.useState('');
  const [zone, setZone] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    setSelectedFile(null);
    setName('');
    setType('');
    setNotes('');
    setZone('');
    setError(null);
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    if (file && !name) {
      setName(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError(t('documents.new.selectFile'));
      return;
    }
    setError(null);
    createDocument.mutate(
      { file: selectedFile, name: name || undefined, type: type || undefined, notes: notes || undefined, zone: zone || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
        },
        onError: () => {
          setError(t('documents.uploadFailed'));
        },
      },
    );
  };

  const typeOptions = [
    { value: '', label: t('documents.filter.allTypes') },
    ...DOCUMENT_TYPES.map((v) => ({
      value: v,
      label: t(`documents.type.${v}`, { defaultValue: v }),
    })),
  ];

  const zoneOptions = [
    { value: '', label: t('documents.upload.noZone') },
    ...zones.map((z) => ({ value: z.id, label: z.full_path || z.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('documents.upload.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* File input */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-file">
              {t('documents.new.selectFile')}
              <span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="upload-file"
              type="file"
              onChange={handleFileChange}
              required
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                {t('documents.new.selectedFile')}: {selectedFile.name}
              </p>
            )}
          </div>

          {/* Name */}
          <FormField label={t('documents.fieldName')} htmlFor="upload-name">
            <Input
              id="upload-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('documents.upload.namePlaceholder')}
              autoComplete="off"
            />
          </FormField>

          {/* Type */}
          <FormField label={t('documents.fieldType')} htmlFor="upload-type">
            <Select
              id="upload-type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType | '')}
              options={typeOptions}
            />
          </FormField>

          {/* Zone */}
          <FormField label={t('documents.upload.zone')} htmlFor="upload-zone">
            <Select
              id="upload-zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              options={zoneOptions}
            />
          </FormField>

          {/* Notes */}
          <FormField label={t('documents.fieldNotes')} htmlFor="upload-notes">
            <Textarea
              id="upload-notes"
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
              disabled={createDocument.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createDocument.isPending}>
              {createDocument.isPending
                ? t('documents.new.submitting')
                : t('documents.upload.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
