import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { documentKeys } from './hooks';
import {
  fetchDocuments,
  fetchPhotoDocuments,
  attachEntityDocument,
  entityDetailQueryKey,
  type DocumentItem,
  type PhotoPhase,
} from '@/lib/api/documents';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  objectId: string;
  attachedIds: Set<string>;
  /** Restrict the candidate pool to a document type (e.g. 'photo'). */
  documentType?: string;
  /** Phase to store on the link when attaching (photos only). */
  phase?: PhotoPhase | '';
  /** Extra invalidation after a successful attach (e.g. the photos entity key). */
  onAttached?: () => void;
  /** Dialog title override (defaults to the documents wording). */
  title?: string;
}

export default function EntityAttachDocumentDialog({
  open,
  onOpenChange,
  entityType,
  objectId,
  attachedIds,
  documentType,
  phase,
  onAttached,
  title,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [isAttaching, setIsAttaching] = React.useState(false);

  const isPhoto = documentType === 'photo';
  const { data: documents = [], isLoading } = useQuery({
    queryKey: [...documentKeys.all, 'attach-pool', documentType ?? 'any', search] as const,
    queryFn: () =>
      isPhoto
        ? fetchPhotoDocuments(search ? { search } : {})
        : fetchDocuments(search ? { search } : {}),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch('');
      setError(null);
    }
  }, [open]);

  const candidates = React.useMemo<DocumentItem[]>(
    () => documents.filter((d) => !attachedIds.has(d.id)),
    [documents, attachedIds],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAttach() {
    if (selected.size === 0) return;
    setError(null);
    setIsAttaching(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          attachEntityDocument(entityType, objectId, id, phase),
        ),
      );
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      const detailKey = entityDetailQueryKey(entityType);
      if (detailKey) void qc.invalidateQueries({ queryKey: detailKey });
      onAttached?.();
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setIsAttaching(false);
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t('documents.link.attach_existing')}
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Input
          placeholder={t('documents.link.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">{t('common.search')}…</p>
          ) : candidates.length === 0 ? (
            <p className="p-3 text-sm italic text-muted-foreground">
              {t('documents.link.empty_candidates')}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {candidates.map((doc) => {
                const checked = selected.has(doc.id);
                return (
                  <li key={doc.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(doc.id)}
                        className="h-4 w-4"
                      />
                      {isPhoto && (doc.thumbnail_url || doc.file_url) ? (
                        <img
                          src={doc.thumbnail_url || doc.file_url || ''}
                          alt={doc.name}
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{doc.name}</p>
                        {!isPhoto && doc.type ? (
                          <p className="text-xs text-muted-foreground">
                            {t(`documents.type.${doc.type}`)}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleAttach}
            disabled={selected.size === 0 || isAttaching}
          >
            {isAttaching
              ? t('common.saving')
              : t('documents.link.attach', { count: selected.size })}
          </Button>
        </div>
      </div>
    </SheetDialog>
  );
}
