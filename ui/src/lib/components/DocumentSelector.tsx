import * as React from 'react';
import { FileText, Search, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import {
  DOCUMENT_TYPES,
  fetchDocuments,
  formatFileSize,
  type DocumentItem,
  type DocumentType,
  uploadDocument,
} from '@/lib/api/documents';

interface DocumentSelectorProps {
  selectedDocumentIds: string[];
  onChange: (documentIds: string[]) => void;
  legend?: string;
  maxSuggestions?: number;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getDocumentPriority(document: DocumentItem): number {
  return document.qualification.qualification_state === 'without_activity' ? 0 : 1;
}

function sortDocuments(left: DocumentItem, right: DocumentItem): number {
  const priorityDiff = getDocumentPriority(left) - getDocumentPriority(right);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return right.created_at.localeCompare(left.created_at);
}

export function DocumentSelector({
  selectedDocumentIds,
  onChange,
  legend,
  maxSuggestions = 8,
}: DocumentSelectorProps) {
  const { t } = useTranslation();
  const resolvedLegend = legend ?? t('documentSelector.legend', { defaultValue: 'Linked documents' });
  const [query, setQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('');
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadName, setUploadName] = React.useState('');
  const [uploadType, setUploadType] = React.useState<DocumentType | ''>('');
  const [uploadNotes, setUploadNotes] = React.useState('');

  const typeOptions = React.useMemo(
    () => DOCUMENT_TYPES.map((value) => ({ value, label: t(`documents.type.${value}`, { defaultValue: value }) })),
    [t]
  );

  React.useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchDocuments();
        if (isMounted) {
          setDocuments([...payload].sort(sortDocuments));
        }
      } catch {
        if (isMounted) {
          setError(t('documentSelector.error', { defaultValue: 'Unable to load documents.' }));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const selectedDocuments = React.useMemo(
    () => documents.filter((document) => selectedDocumentIds.includes(document.id)).sort(sortDocuments),
    [documents, selectedDocumentIds]
  );

  const normalizedQuery = normalizeQuery(query);
  const suggestions = React.useMemo(() => {
    const unselectedDocuments = documents.filter((document) => !selectedDocumentIds.includes(document.id));
    const filteredDocuments = unselectedDocuments.filter((document) => {
      if (selectedType && document.type !== selectedType) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [document.name, document.type, document.notes || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return [...filteredDocuments].sort(sortDocuments).slice(0, maxSuggestions);
  }, [documents, maxSuggestions, normalizedQuery, selectedDocumentIds, selectedType]);

  function addDocument(documentId: string) {
    if (selectedDocumentIds.includes(documentId)) {
      return;
    }
    onChange([...selectedDocumentIds, documentId]);
    setQuery('');
  }

  function removeDocument(documentId: string) {
    onChange(selectedDocumentIds.filter((currentId) => currentId !== documentId));
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError(t('documentSelector.upload_file_required', { defaultValue: 'Select a file first.' }));
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const response = await uploadDocument({
        file: selectedFile,
        name: uploadName || selectedFile.name,
        type: uploadType,
        notes: uploadNotes,
      });

      const createdDocument: DocumentItem = response.document;
      setDocuments((current) => {
        const next = current.filter((document) => document.id !== createdDocument.id);
        next.push(createdDocument);
        return next.sort(sortDocuments);
      });
      onChange(selectedDocumentIds.includes(createdDocument.id) ? selectedDocumentIds : [...selectedDocumentIds, createdDocument.id]);
      setSelectedFile(null);
      setUploadName('');
      setUploadType('');
      setUploadNotes('');
      setUploadOpen(false);
    } catch {
      setUploadError(t('documentSelector.upload_failed', { defaultValue: 'Unable to upload the document.' }));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);
    if (file && !uploadName) {
      setUploadName(file.name);
    }
  }

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium">{resolvedLegend}</legend>
        {selectedDocumentIds.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('documentSelector.selected_count', {
              count: selectedDocumentIds.length,
              defaultValue: '{{count}} selected',
            })}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
        {selectedDocuments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedDocuments.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => removeDocument(document.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-950 transition-colors hover:bg-emerald-100"
                aria-label={t('documentSelector.remove_document', {
                  name: document.name,
                  defaultValue: `Remove ${document.name}`,
                })}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{document.name}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('documentSelector.none_selected', {
              defaultValue: 'No documents linked yet.',
            })}
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="document-selector-input" className="text-xs font-medium text-muted-foreground">
            {t('documentSelector.search_label', { defaultValue: 'Find an existing document' })}
          </label>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1.8fr)_minmax(12rem,1fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="document-selector-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('documentSelector.placeholder', { defaultValue: 'Search by document name' })}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              options={typeOptions}
              placeholder={t('documentSelector.type_filter_placeholder', { defaultValue: 'All document types' })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('documentSelector.helper', {
              defaultValue: 'Select one or more existing documents to link to this activity.',
            })}
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('documentSelector.upload_title', { defaultValue: 'Add a document now' })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('documentSelector.upload_helper', { defaultValue: 'Upload a document here and link it immediately to this activity.' })}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setUploadOpen((current) => !current)}>
              {uploadOpen ? t('documentSelector.upload_cancel', { defaultValue: 'Close upload' }) : t('documentSelector.upload_open', { defaultValue: 'Upload a document' })}
            </Button>
          </div>

          {uploadOpen ? (
            <form className="mt-3 space-y-3" onSubmit={handleUpload}>
              {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}

              <div className="space-y-1.5">
                <label htmlFor="interaction-document-upload-file" className="text-xs font-medium text-muted-foreground">
                  {t('documents.new.selectFile', { defaultValue: 'Select a file' })}
                </label>
                <Input id="interaction-document-upload-file" type="file" onChange={handleFileChange} required />
                {selectedFile ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedFile.name}
                    {typeof selectedFile.size === 'number' ? ` · ${formatFileSize(selectedFile.size)}` : ''}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="interaction-document-upload-name" className="text-xs font-medium text-muted-foreground">
                    {t('documents.fieldName', { defaultValue: 'Name' })}
                  </label>
                  <Input
                    id="interaction-document-upload-name"
                    value={uploadName}
                    onChange={(event) => setUploadName(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="interaction-document-upload-type" className="text-xs font-medium text-muted-foreground">
                    {t('documents.fieldType', { defaultValue: 'Type' })}
                  </label>
                  <Select
                    id="interaction-document-upload-type"
                    value={uploadType}
                    onChange={(event) => setUploadType(event.target.value as DocumentType | '')}
                    options={typeOptions}
                    placeholder={t('documents.fieldType', { defaultValue: 'Type' })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="interaction-document-upload-notes" className="text-xs font-medium text-muted-foreground">
                  {t('documents.fieldNotes', { defaultValue: 'Notes' })}
                </label>
                <Textarea
                  id="interaction-document-upload-notes"
                  rows={3}
                  value={uploadNotes}
                  onChange={(event) => setUploadNotes(event.target.value)}
                  placeholder={t('documents.fieldNotesPlaceholder', { defaultValue: 'Optional notes…' })}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={uploading}>
                  <Upload className="mr-1 h-4 w-4" />
                  {uploading
                    ? t('documentSelector.upload_submitting', { defaultValue: 'Uploading…' })
                    : t('documentSelector.upload_submit', { defaultValue: 'Upload and link' })}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setUploadOpen(false)} disabled={uploading}>
                  <X className="mr-1 h-4 w-4" />
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Button>
              </div>
            </form>
          ) : null}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">
            {t('documentSelector.loading', { defaultValue: 'Loading documents…' })}
          </p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {!loading && !error ? (
          <div className="space-y-2">
            {suggestions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {normalizedQuery
                    ? t('documentSelector.results_label', { defaultValue: 'Matching documents' })
                    : t('documentSelector.recent_label', { defaultValue: 'Recent documents' })}
                </p>
                <div className="space-y-2">
                  {suggestions.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => addDocument(document.id)}
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{document.name}</p>
                          {document.qualification.qualification_state === 'without_activity' ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                              {t('documentSelector.priority_badge', { defaultValue: 'To link first' })}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(`documents.type.${document.type}`, { defaultValue: document.type })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-medium text-primary">
                          {t('documentSelector.add_action', { defaultValue: 'Link' })}
                        </span>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {document.qualification.linked_interactions_count > 0
                            ? t('documentSelector.activity_count', {
                                count: document.qualification.linked_interactions_count,
                                defaultValue: '{{count}} activity',
                              })
                            : t('documentSelector.no_activity_yet', { defaultValue: 'No activity yet' })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('documentSelector.empty', {
                  defaultValue: 'No document matches this search.',
                })}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

export default DocumentSelector;