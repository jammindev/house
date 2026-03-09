import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import { uploadDocument, type DocumentType } from '@/lib/api/documents';
import { useHouseholdId } from '@/lib/useHouseholdId';
import type { DocumentCreatePageProps } from '@/pages/documents/new';

export default function DocumentCreatePage({ allowedTypes, cancelUrl, defaultType }: DocumentCreatePageProps) {
  const { t } = useTranslation();
  const householdId = useHouseholdId();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<DocumentType | ''>((defaultType as DocumentType | null) ?? '');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    if (file) {
      setName(file.name);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError(t('documents.new.selectFile'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await uploadDocument(
        {
          file: selectedFile,
          name,
          type,
          notes,
        },
        householdId,
      );
      window.location.assign(response.detail_url);
    } catch {
      setError(t('documents.loadFailed'));
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t('documents.new.title')}</CardTitle>
        <CardDescription>{t('documents.new.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="document-file">
              {t('documents.new.selectFile')}
            </label>
            <Input id="document-file" type="file" onChange={handleFileChange} required />
            {selectedFile ? (
              <p className="text-xs text-muted-foreground">
                {t('documents.new.selectedFile')}: {selectedFile.name}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="document-name">
              {t('documents.fieldName')}
            </label>
            <Input id="document-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="document-type">
              {t('documents.fieldType')}
            </label>
            <Select
              id="document-type"
              value={type}
              onChange={(event) => setType(event.target.value as DocumentType | '')}
              options={allowedTypes}
              placeholder={t('documents.fieldType')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="document-notes">
              {t('documents.fieldNotes')}
            </label>
            <Textarea
              id="document-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('documents.fieldNotesPlaceholder')}
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t('documents.new.submitting') : t('documents.new.submit')}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign(cancelUrl)} disabled={submitting}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
