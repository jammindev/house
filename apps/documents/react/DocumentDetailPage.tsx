import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { fetchDocumentDetail, type DocumentDetail } from '@/lib/api/documents';
import { linkDocumentToInteraction, searchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { useToast } from '@/lib/toast';
import { useHouseholdId } from '@/lib/useHouseholdId';
import type { DocumentDetailPageProps } from '@/pages/documents/detail';

type AttachableInteraction = {
  id: string;
  subject: string;
  occurred_at: string;
};

export default function DocumentDetailPage({
  createInteractionUrl,
  documentId,
  initialDocument,
  initialRecentInteractionCandidates,
  listUrl,
}: DocumentDetailPageProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const householdId = useHouseholdId();
  const [document, setDocument] = React.useState<DocumentDetail | null>(initialDocument);
  const [loading, setLoading] = React.useState(!initialDocument);
  const [error, setError] = React.useState<string | null>(null);
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<InteractionListItem[]>([]);
  const [attachingInteractionId, setAttachingInteractionId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDocumentDetail(documentId, householdId)
      .then((payload) => {
        setDocument(payload);
        setLoading(false);
      })
      .catch(() => {
        setError(t('documents.loadFailed'));
        setLoading(false);
      });
  }, [documentId, householdId, t]);

  React.useEffect(() => {
    if (initialDocument) {
      return;
    }
    refresh();
  }, [initialDocument, refresh]);

  const linkedInteractionIds = React.useMemo(
    () => new Set(document?.linked_interactions.map((item) => item.id) ?? []),
    [document]
  );

  const recentCandidates = React.useMemo(
    () => (document?.recent_interaction_candidates ?? initialRecentInteractionCandidates)
      .filter((interaction) => !linkedInteractionIds.has(interaction.id)),
    [document, initialRecentInteractionCandidates, linkedInteractionIds]
  );

  const visibleSearchResults = React.useMemo(
    () => searchResults.filter((interaction) => !linkedInteractionIds.has(interaction.id)),
    [linkedInteractionIds, searchResults]
  );

  const handleAttach = React.useCallback(async (interactionId: string) => {
    setAttachError(null);
    setAttachingInteractionId(interactionId);

    try {
      await linkDocumentToInteraction({ interactionId, documentId }, householdId);
      toast({ title: t('documents.attach.success'), variant: 'success' });
      setSearchResults((current) => current.filter((item) => item.id !== interactionId));
      refresh();
    } catch (attachRequestError) {
      const message = attachRequestError instanceof Error
        ? attachRequestError.message
        : t('documents.attach.failed');
      setAttachError(message || t('documents.attach.failed'));
      toast({
        title: t('documents.attach.failed'),
        description: message || undefined,
        variant: 'destructive',
      });
    } finally {
      setAttachingInteractionId(null);
    }
  }, [documentId, householdId, refresh, t, toast]);

  const handleSearch = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      setAttachError(null);
      return;
    }

    setSearching(true);
    setAttachError(null);
    try {
      const payload = await searchInteractions(query, { householdId, limit: 8 });
      setSearchResults(payload.items);
    } catch {
      setAttachError(t('documents.attach.searchFailed'));
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [householdId, searchTerm, t]);

  const qualificationLabel = document?.qualification.qualification_state === 'activity_linked'
    ? t('documents.qualification.activityLinked')
    : t('documents.qualification.withoutActivity');

  function renderInteractionCandidates(items: AttachableInteraction[], emptyLabel: string) {
    if (items.length === 0) {
      return <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
    }

    return (
      <ul className="mt-3 space-y-2 text-sm text-foreground">
        {items.map((interaction) => {
          const isAttaching = attachingInteractionId === interaction.id;
          return (
            <li key={interaction.id} className="flex flex-col gap-3 rounded-md border border-border px-3 py-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{interaction.subject}</div>
                <div className="text-xs text-muted-foreground">{new Date(interaction.occurred_at).toLocaleString()}</div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleAttach(interaction.id)}
                disabled={Boolean(attachingInteractionId) || linkedInteractionIds.has(interaction.id)}
              >
                {isAttaching ? t('documents.attach.linking') : t('documents.attach.submit')}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{document?.name || t('documents.detail.title')}</CardTitle>
        <CardDescription>{t('documents.detail.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p> : null}
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {document ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.detail.identity')}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{document.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`documents.type.${document.type}`, { defaultValue: document.type })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {document.created_by_name || '—'} · {new Date(document.created_at).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.detail.qualification')}</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {qualificationLabel}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('documents.detail.linkedCount', { count: document.qualification.linked_interactions_count })}
                </p>
              </div>
            </div>

            {document.notes ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.fieldNotes')}</p>
                <p className="mt-1 text-sm text-foreground">{document.notes}</p>
              </div>
            ) : null}

            {document.ocr_text ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.detail.ocr')}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{document.ocr_text}</p>
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.detail.currentContext')}</p>
              {document.linked_interactions.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {document.linked_interactions.map((interaction) => (
                    <li key={interaction.id} className="rounded-md border border-border px-3 py-2">
                      <div className="font-medium">{interaction.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(`interactions.type_${interaction.type}`, { defaultValue: interaction.type })}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('documents.attach.empty')}</p>
              )}
            </div>

            {(document.zone_links.length > 0 || document.project_links.length > 0) ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.detail.secondaryContext')}</p>
                {document.zone_links.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground">{t('documents.detail.zones')}</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {document.zone_links.map((zone) => (
                        <li key={zone.zone_id} className="rounded-full border border-border px-3 py-1 text-sm text-foreground">
                          {zone.zone_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {document.project_links.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground">{t('documents.detail.projects')}</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {document.project_links.map((project) => (
                        <li key={project.project_id} className="rounded-full border border-border px-3 py-1 text-sm text-foreground">
                          {project.project_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.attach.title')}</p>
              {attachError ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {attachError}
                </div>
              ) : null}
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">{t('documents.attach.recent')}</p>
                {renderInteractionCandidates(recentCandidates, t('documents.attach.noRecent'))}
              </div>
              <form className="mt-4 space-y-3" onSubmit={handleSearch}>
                <label htmlFor="document-attach-search" className="text-xs font-medium text-muted-foreground">
                  {t('documents.attach.search')}
                </label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    id="document-attach-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t('documents.attach.searchPlaceholder')}
                  />
                  <Button type="submit" variant="outline" disabled={searching}>
                    {searching ? t('common.loading', { defaultValue: 'Loading…' }) : t('documents.attach.searchButton')}
                  </Button>
                </div>
              </form>
              {searchTerm.trim() ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground">{t('documents.attach.searchResults')}</p>
                  {renderInteractionCandidates(visibleSearchResults, t('documents.attach.noneFound'))}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documents.detail.actions')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('documents.createActivity.title')}</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.location.assign(listUrl)}>
            {t('documents.detail.backToList')}
          </Button>
          {document?.file_url ? (
            <Button type="button" variant="outline" onClick={() => window.open(document.file_url || '', '_blank', 'noopener,noreferrer')}>
              {t('documents.openOriginal')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={refresh}>
            {t('common.retry', { defaultValue: 'Refresh' })}
          </Button>
          <Button type="button" onClick={() => window.location.assign(createInteractionUrl)}>
            {t('documents.createActivity.cta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
