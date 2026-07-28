import * as React from 'react';
import { FileText, FileWarning, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import EmptyState from '@/components/EmptyState';
import LoadError from '@/components/LoadError';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { Input } from '@/design-system/input';
import { Label } from '@/design-system/label';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSessionState } from '@/lib/useSessionState';
import { formatMonthYear } from '@/lib/format';
import { DOCUMENT_TYPES, type DocumentItem } from '@/lib/api/documents';
import { useDocuments, useDeleteDocument, documentKeys } from './hooks';
import { countByType, groupDocuments, isWithoutContext, type GroupMode } from './grouping';
import DocumentCard from './DocumentCard';
import DocumentUploadDialog from './DocumentUploadDialog';
import DocumentEditDialog from './DocumentEditDialog';

const GROUP_MODES: GroupMode[] = ['type', 'date'];

export default function DocumentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState('');
  const [type, setType] = useSessionState<string>('documents.type', '');
  const [withoutContext, setWithoutContext] = useSessionState<boolean>(
    'documents.withoutContext',
    false,
  );
  const [groupMode, setGroupMode] = useSessionState<GroupMode>('documents.groupBy', 'type');
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);

  // Une frappe ne vaut pas une requête : la recherche partait à chaque caractère.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  /**
   * Seule la recherche est un filtre serveur — elle doit l'être, car elle porte sur
   * le texte OCR que le client n'a pas. Type et « sans contexte » se filtrent ici :
   * c'est ce qui permet aux pastilles de porter des **compteurs**, et un compteur
   * calculé sur une liste que le serveur a déjà réduite dirait le contraire de ce
   * que le clic produit. La liste n'est pas paginée (comme la galerie), donc le
   * client a bien tout sous la main.
   */
  const filters = React.useMemo(
    () => (debouncedSearch ? { search: debouncedSearch } : {}),
    [debouncedSearch],
  );

  const { data: documents = [], isLoading, error } = useDocuments(filters);
  const deleteDocumentMutation = useDeleteDocument();

  const counts = React.useMemo(() => countByType(documents), [documents]);
  const withoutContextCount = React.useMemo(
    () => documents.filter(isWithoutContext).length,
    [documents],
  );

  const visible = React.useMemo(
    () =>
      documents.filter(
        (doc) =>
          (!type || (doc.type || 'document') === type) &&
          (!withoutContext || isWithoutContext(doc)),
      ),
    [documents, type, withoutContext],
  );

  const groups = React.useMemo(() => groupDocuments(visible, groupMode), [visible, groupMode]);

  const handleSaved = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: documentKeys.all });
  }, [qc]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('documents.deleted'),
    onDelete: (id) => deleteDocumentMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      deleteWithUndo(docId, {
        onRemove: () =>
          qc.setQueryData<DocumentItem[]>(documentKeys.list(filters), (old) =>
            old?.filter((d) => d.id !== docId),
          ),
        onRestore: () =>
          qc.setQueryData<DocumentItem[]>(documentKeys.list(filters), (old) =>
            old ? [...old, doc] : [doc],
          ),
      });
    },
    [documents, deleteWithUndo, qc, filters],
  );

  const hasFilters = debouncedSearch !== '' || type !== '' || withoutContext;

  const resetFilters = React.useCallback(() => {
    setSearch('');
    setType('');
    setWithoutContext(false);
  }, [setType, setWithoutContext]);

  /**
   * « Les factures » et « celles sans contexte » se cumulent volontiers, mais choisir
   * un type quand on cherchait à qualifier fait sortir de la file de travail sans le
   * dire. On garde donc les deux indépendants — c'est un cumul, pas une exclusion —
   * et le compteur de chaque pastille reste lu sur la liste complète, pour que
   * revenir en arrière soit toujours possible.
   */
  const toggleType = React.useCallback(
    (next: string) => setType((current) => (current === next ? '' : next)),
    [setType],
  );

  // `ListPage` masque ses enfants quand la liste est vide — donc la barre de filtres
  // avec. On ne lui déclare « vide » que la liste réellement vide : sinon une
  // recherche sans résultat effaçait le champ qui l'a produite, et il devenait
  // impossible de revenir en arrière.
  const isTrulyEmpty = !isLoading && !error && documents.length === 0 && !hasFilters;
  const isNoResults = !isLoading && !error && visible.length === 0 && hasFilters;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <>
      <ListPage
        title={t('documents.title')}
        description={
          !isLoading && !error && documents.length > 0
            ? t('documents.count.all', { count: documents.length })
            : undefined
        }
        isEmpty={isTrulyEmpty}
        emptyState={{
          icon: FileText,
          title: t('documents.empty'),
          description: t('documents.empty_description'),
          action: { label: t('documents.upload.title'), onClick: () => setUploadOpen(true) },
        }}
        actions={
          <Button type="button" onClick={() => setUploadOpen(true)}>
            {t('documents.upload.title')}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1 sm:max-w-xs">
              <Label htmlFor="documents-search">{t('documents.search')}</Label>
              <Input
                id="documents-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('documents.search_placeholder')}
              />
            </div>
            {hasFilters ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                {t('documents.filter.reset')}
              </Button>
            ) : null}
          </div>

          {/* Le paysage d'un coup d'œil : ce qui existe, et en quelle quantité. Les
              compteurs suivent la recherche courante — et quand elle ne ramène rien,
              une rangée réduite à « Tous les types 0 » ne pilote plus rien. */}
          {documents.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={type === ''} onClick={() => setType('')}>
                {t('documents.filter.allTypes')}
                <span className="tabular-nums opacity-70">{counts[''] ?? 0}</span>
              </FilterPill>
              {DOCUMENT_TYPES.filter((v) => (counts[v] ?? 0) > 0).map((v) => (
                <FilterPill key={v} active={type === v} onClick={() => toggleType(v)}>
                  {t(`documents.type.${v}`)}
                  <span className="tabular-nums opacity-70">{counts[v]}</span>
                </FilterPill>
              ))}
              {withoutContextCount > 0 ? (
                <FilterPill
                  active={withoutContext}
                  onClick={() => setWithoutContext((current) => !current)}
                >
                  <FileWarning className="h-3 w-3" aria-hidden="true" />
                  {t('documents.qualification.withoutActivity')}
                  <span className="tabular-nums opacity-70">{withoutContextCount}</span>
                </FilterPill>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <LoadError
              message={t('documents.loadFailed')}
              onRetry={() => void qc.invalidateQueries({ queryKey: documentKeys.all })}
              retryLabel={t('common.retry')}
            />
          ) : showSkeleton ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : isNoResults ? (
            <EmptyState
              icon={SearchX}
              title={t('common.noResults')}
              description={t('documents.noResults_description')}
              action={{ label: t('documents.filter.reset'), onClick: resetFilters }}
            />
          ) : (
            <>
              {/* Un seul groupe ne se « groupe » pas : la bascule n'aurait rien à
                  changer, et un en-tête au-dessus de l'unique section serait du bruit. */}
              {groups.length > 1 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {t('documents.filter.groupBy')}
                  </span>
                  {GROUP_MODES.map((mode) => (
                    <FilterPill
                      key={mode}
                      active={groupMode === mode}
                      onClick={() => setGroupMode(mode)}
                    >
                      {t(`documents.filter.groupBy_${mode}`)}
                    </FilterPill>
                  ))}
                </div>
              ) : null}

              <div className="space-y-6">
                {groups.map((group) => (
                  <section key={group.key} className="space-y-2">
                    {groups.length > 1 ? (
                      <h2 className="text-sm font-medium capitalize text-muted-foreground">
                        {group.type
                          ? t(`documents.type.${group.type}`)
                          : formatMonthYear(group.anchor)}{' '}
                        <span className="tabular-nums">({group.documents.length})</span>
                      </h2>
                    ) : null}
                    <ul className="space-y-2">
                      {group.documents.map((doc) => (
                        <DocumentCard
                          key={doc.id}
                          doc={doc}
                          onEdit={setEditingDoc}
                          onDelete={handleDelete}
                          showEntityLinks
                          // L'en-tête de section ou la pastille active dit déjà le
                          // type ; le répéter sur chaque ligne vole la place du nom.
                          hideType={groupMode === 'type' || type !== ''}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </ListPage>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSaved={handleSaved}
      />

      <DocumentEditDialog
        open={editingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
        doc={editingDoc}
        onSaved={handleSaved}
      />
    </>
  );
}
