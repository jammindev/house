import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Image, MessageSquare, Paperclip, Trash2 } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import type { Task } from '@/lib/api/tasks';
import { fetchDocuments, fetchPhotoDocuments, type DocumentItem } from '@/lib/api/documents';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import {
  useTaskDocuments,
  useTaskInteractions,
  useLinkDocument,
  useUnlinkDocument,
  useLinkInteraction,
  useUnlinkInteraction,
} from './hooks';
import TaskItemPicker from './TaskItemPicker';

interface TaskAttachmentsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PickerMode = 'document' | 'photo' | 'interaction' | null;

export default function TaskAttachmentsDialog({
  task,
  open,
  onOpenChange,
}: TaskAttachmentsDialogProps) {
  const { t } = useTranslation();
  const [pickerMode, setPickerMode] = React.useState<PickerMode>(null);
  const [allDocuments, setAllDocuments] = React.useState<DocumentItem[]>([]);
  const [allPhotos, setAllPhotos] = React.useState<DocumentItem[]>([]);
  const [allInteractions, setAllInteractions] = React.useState<InteractionListItem[]>([]);
  const [itemsLoading, setItemsLoading] = React.useState(false);

  const taskId = task?.id ?? '';

  const { data: linkedDocs = [] } = useTaskDocuments(taskId);
  const { data: linkedInteractions = [] } = useTaskInteractions(taskId);
  const linkDocument = useLinkDocument();
  const unlinkDocument = useUnlinkDocument();
  const linkInteraction = useLinkInteraction();
  const unlinkInteraction = useUnlinkInteraction();

  // Load all items when picker opens
  React.useEffect(() => {
    if (!pickerMode || !open) return;
    setItemsLoading(true);
    const promise =
      pickerMode === 'document'
        ? fetchDocuments().then((docs) => { setAllDocuments(docs); })
        : pickerMode === 'photo'
          ? fetchPhotoDocuments().then((photos) => { setAllPhotos(photos); })
          : fetchInteractions({ limit: 200 }).then(({ items }) => { setAllInteractions(items); });
    promise.finally(() => setItemsLoading(false));
  }, [pickerMode, open]);

  if (!task) return null;

  const linkedDocIds = linkedDocs.map((l) => l.document_id);
  const linkedPhotoIds = linkedDocs
    .filter((l) => l.type === 'photo')
    .map((l) => l.document_id);
  const linkedInteractionIds = linkedInteractions.map((l) => l.interaction_id);

  const documents = linkedDocs.filter((l) => l.type !== 'photo');
  const photos = linkedDocs.filter((l) => l.type === 'photo');

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          {t('tasks.attachmentsTitle')}
          {task.subject ? (
            <span className="truncate text-sm font-normal text-muted-foreground">
              — {task.subject}
            </span>
          ) : null}
        </span>
      }
    >
        <div className="space-y-5 pb-4">
          {/* Documents */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t('tasks.linkedDocuments')}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickerMode(pickerMode === 'document' ? null : 'document')}
              >
                {t('tasks.addDocument')}
              </Button>
            </div>

            {pickerMode === 'document' && (
              <TaskItemPicker
                title={t('tasks.pickDocument')}
                items={allDocuments}
                isLoading={itemsLoading}
                getId={(d) => d.id}
                getLabel={(d) => d.name}
                getSublabel={(d) => d.type}
                onSelect={(d) => linkDocument.mutate({ taskId, documentId: d.id })}
                onClose={() => setPickerMode(null)}
                alreadyLinkedIds={linkedDocIds}
                emptyText={t('tasks.noLinkedDocuments')}
              />
            )}

            {documents.length === 0 && pickerMode !== 'document' ? (
              <p className="text-xs text-muted-foreground">{t('tasks.noLinkedDocuments')}</p>
            ) : (
              <ul className="space-y-1">
                {documents.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{link.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{link.type}</span>
                    <button
                      type="button"
                      onClick={() => unlinkDocument.mutate({ linkId: link.id, taskId })}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Photos */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Image className="h-4 w-4 text-muted-foreground" />
                {t('tasks.linkedPhotos')}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickerMode(pickerMode === 'photo' ? null : 'photo')}
              >
                {t('tasks.addPhoto')}
              </Button>
            </div>

            {pickerMode === 'photo' && (
              <TaskItemPicker
                title={t('tasks.pickDocument')}
                items={allPhotos}
                isLoading={itemsLoading}
                getId={(d) => d.id}
                getLabel={(d) => d.name}
                onSelect={(d) => linkDocument.mutate({ taskId, documentId: d.id })}
                onClose={() => setPickerMode(null)}
                alreadyLinkedIds={linkedPhotoIds}
                emptyText={t('tasks.noLinkedDocuments')}
              />
            )}

            {photos.length === 0 && pickerMode !== 'photo' ? (
              <p className="text-xs text-muted-foreground">{t('tasks.noLinkedDocuments')}</p>
            ) : (
              <ul className="space-y-1">
                {photos.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                    {link.file_url ? (
                      <img
                        src={link.file_url}
                        alt={link.name}
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{link.name}</span>
                    <button
                      type="button"
                      onClick={() => unlinkDocument.mutate({ linkId: link.id, taskId })}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Interactions */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                {t('tasks.linkedInteractions')}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickerMode(pickerMode === 'interaction' ? null : 'interaction')}
              >
                {t('tasks.addInteraction')}
              </Button>
            </div>

            {pickerMode === 'interaction' && (
              <TaskItemPicker
                title={t('tasks.pickInteraction')}
                items={allInteractions}
                isLoading={itemsLoading}
                getId={(i) => i.id}
                getLabel={(i) => i.subject}
                getSublabel={(i) => i.type}
                onSelect={(i) => linkInteraction.mutate({ taskId, interactionId: i.id })}
                onClose={() => setPickerMode(null)}
                alreadyLinkedIds={linkedInteractionIds}
                emptyText={t('tasks.noLinkedInteractions')}
              />
            )}

            {linkedInteractions.length === 0 && pickerMode !== 'interaction' ? (
              <p className="text-xs text-muted-foreground">{t('tasks.noLinkedInteractions')}</p>
            ) : (
              <ul className="space-y-1">
                {linkedInteractions.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{link.subject}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{link.type}</span>
                    <button
                      type="button"
                      onClick={() => unlinkInteraction.mutate({ linkId: link.id, taskId })}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
    </SheetDialog>
  );
}
