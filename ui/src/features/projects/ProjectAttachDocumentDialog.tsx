import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { useDocuments, documentKeys } from '@/features/documents/hooks';
import { useAttachProjectDocument } from './hooks';
import type { DocumentItem } from '@/lib/api/documents';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  attachedIds: Set<string>;
}

export default function ProjectAttachDocumentDialog({
  open,
  onOpenChange,
  projectId,
  attachedIds,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  const filters = React.useMemo(
    () => (search ? { search } : {}),
    [search],
  );
  const { data: documents = [], isLoading } = useDocuments(filters);
  const attachMutation = useAttachProjectDocument(projectId);

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
    try {
      await Promise.all(
        Array.from(selected).map((id) => attachMutation.mutateAsync(id)),
      );
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('projects.attach_document.title')}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Input
            placeholder={t('projects.attach_document.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">{t('common.search')}…</p>
            ) : candidates.length === 0 ? (
              <p className="p-3 text-sm italic text-muted-foreground">
                {t('projects.attach_document.empty')}
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
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{doc.name}</p>
                          {doc.type ? (
                            <p className="text-xs text-muted-foreground">
                              {t(`documents.type.${doc.type}`, { defaultValue: doc.type })}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={attachMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleAttach}
              disabled={selected.size === 0 || attachMutation.isPending}
            >
              {attachMutation.isPending
                ? t('common.saving')
                : t('projects.attach_document.attach', { count: selected.size })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
