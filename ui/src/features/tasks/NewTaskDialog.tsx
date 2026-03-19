import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { CheckboxField } from '@/design-system/checkbox-field';
import { fetchProjects } from '@/lib/api/projects';
import type { ProjectListItem } from '@/lib/api/projects';
import { fetchDocuments, fetchPhotoDocuments, type DocumentItem } from '@/lib/api/documents';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import {
  createTask, fetchZones, updateTask,
  type Zone, type Task, type HouseholdMember, type TaskPriority, type TaskStatus,
} from '@/lib/api/tasks';

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  existingTask?: Task;
  onUpdated?: (task: Task) => void;
  householdMembers?: HouseholdMember[];
  /** Pre-fill project when opening from a project page */
  defaultProjectId?: string;
}

export default function NewTaskDialog({
  open,
  onOpenChange,
  onCreated,
  existingTask,
  onUpdated,
  householdMembers = [],
  defaultProjectId,
}: NewTaskDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingTask);

  const priorityOptions = [
    { value: '1', label: t('tasks.priorityHigh_label') },
    { value: '2', label: t('tasks.priorityNormal_label') },
    { value: '3', label: t('tasks.priorityLow_label') },
  ];

  const statusOptions = [
    { value: 'pending', label: t('tasks.sections.pending') },
    { value: 'backlog', label: t('tasks.sections.backlog') },
  ];

  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState<string>('2');
  const [status, setStatus] = React.useState<string>('pending');
  const [assignedToId, setAssignedToId] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [projects, setProjects] = React.useState<ProjectListItem[]>([]);
  const [zonesLoading, setZonesLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Attachment selection state (create only)
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [selectedInteractionIds, setSelectedInteractionIds] = React.useState<string[]>([]);
  const [allDocuments, setAllDocuments] = React.useState<DocumentItem[]>([]);
  const [allInteractions, setAllInteractions] = React.useState<InteractionListItem[]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded] = React.useState(false);

  const loadZones = React.useCallback(() => {
    setZonesLoading(true);
    Promise.all([fetchZones(), fetchProjects()])
      .then(([zoneList, projectList]) => {
        setZones(zoneList);
        setProjects(projectList);
        setZonesLoading(false);
      })
      .catch(() => setZonesLoading(false));
  }, []);

  const loadAttachmentItems = React.useCallback(() => {
    if (attachmentsLoaded) return;
    setAttachmentsLoaded(true);
    Promise.all([
      fetchDocuments(),
      fetchPhotoDocuments(),
      fetchInteractions({ limit: 200 }),
    ]).then(([docs, photos, interResult]) => {
      setAllDocuments([...docs, ...photos]);
      setAllInteractions(interResult.items);
    }).catch(() => {});
  }, [attachmentsLoaded]);

  React.useEffect(() => {
    if (!open) return;
    if (existingTask) {
      setSubject(existingTask.subject || '');
      setContent(existingTask.content || '');
      setDueDate(existingTask.due_date ?? '');
      setPriority(String(existingTask.priority ?? 2));
      setAssignedToId(existingTask.assigned_to ?? '');
      setProjectId(existingTask.project ?? defaultProjectId ?? '');
      setIsPrivate(existingTask.is_private ?? false);
    } else {
      setSubject('');
      setContent('');
      setDueDate('');
      setPriority('2');
      setStatus('pending');
      setAssignedToId('');
      setZoneId('');
      setProjectId(defaultProjectId ?? '');
      setIsPrivate(false);
      setSelectedDocumentIds([]);
      setSelectedInteractionIds([]);
      setAttachmentsLoaded(false);
    }
    setError(null);
    loadZones();
  }, [open, existingTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (zones.length === 0) return;
    if (existingTask?.zone_names?.length) {
      const match = zones.find((z) => existingTask.zone_names.includes(z.name));
      if (match) setZoneId(match.id);
    } else if (!existingTask && zones.length === 1) {
      setZoneId(zones[0].id);
    }
  }, [zones]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneId) {
      setError(t('tasks.zoneRequired'));
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      subject,
      content: content || undefined,
      zone_ids: [zoneId],
      due_date: dueDate || null,
      priority: (Number(priority) || null) as TaskPriority,
      assigned_to_id: assignedToId || null,
      project: projectId || null,
      is_private: isPrivate,
    };

    if (isEditing && existingTask) {
      updateTask(existingTask.id, payload)
        .then((updated) => {
          setLoading(false);
          onOpenChange(false);
          if (onUpdated) onUpdated(updated);
        })
        .catch(() => {
          setLoading(false);
          setError(t('tasks.updateFailed'));
        });
    } else {
      createTask({
        ...payload,
        status: status as TaskStatus,
        document_ids: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        interaction_ids: selectedInteractionIds.length > 0 ? selectedInteractionIds : undefined,
      } as Parameters<typeof createTask>[0])
        .then(() => {
          setLoading(false);
          onOpenChange(false);
          onCreated();
        })
        .catch(() => {
          setLoading(false);
          setError(t('tasks.createFailed'));
        });
    }
  };

  const toggleDocumentId = (id: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleInteractionId = (id: string) => {
    setSelectedInteractionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.name }));
  const memberOptions = householdMembers.map((m) => ({ value: m.userId, label: m.name }));
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.title }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('tasks.editTitle') : t('tasks.newTask')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <FormField label={t('tasks.fieldSubject')} htmlFor="task-subject">
            <Input
              id="task-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              autoComplete="off"
              placeholder={t('tasks.fieldSubjectPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('tasks.fieldZone')} htmlFor="task-zone">
              <Select
                id="task-zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                options={zoneOptions}
                placeholder={
                  zonesLoading
                    ? t('tasks.loadingZones')
                    : t('tasks.selectZone')
                }
                required
              />
            </FormField>

            <FormField label={t('tasks.fieldPriority')} htmlFor="task-priority">
              <Select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={priorityOptions}
              />
            </FormField>
          </div>

          <div className={isEditing ? undefined : 'grid grid-cols-2 gap-3'}>
            <FormField label={t('tasks.fieldDate')} htmlFor="task-date">
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>

            {!isEditing && (
              <FormField label={t('tasks.fieldStatus')} htmlFor="task-status">
                <Select
                  id="task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={statusOptions}
                />
              </FormField>
            )}
          </div>

          {memberOptions.length > 1 && !isPrivate && (
            <FormField label={t('tasks.fieldAssignedTo')} htmlFor="task-assigned">
              <Select
                id="task-assigned"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                options={memberOptions}
                placeholder={t('tasks.noAssignee')}
              />
            </FormField>
          )}

          {projectOptions.length > 0 && (
            <FormField label={t('tasks.fieldProject')} htmlFor="task-project">
              <Select
                id="task-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={projectOptions}
                placeholder={t('tasks.noProject')}
              />
            </FormField>
          )}

          <FormField label={t('tasks.fieldContent')} htmlFor="task-content">
            <Textarea
              id="task-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={t('tasks.fieldContentPlaceholder')}
            />
          </FormField>

          {householdMembers.length > 1 && (
            <CheckboxField
              id="task-private"
              label={t('tasks.fieldPrivate')}
              checked={isPrivate}
              onChange={(val) => { setIsPrivate(val); if (val) setAssignedToId(''); }}
            />
          )}

          {!isEditing && (
            <details className="group" onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) loadAttachmentItems();
            }}>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                {t('tasks.addAttachments')}
                {selectedDocumentIds.length + selectedInteractionIds.length > 0 && (
                  <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                    {selectedDocumentIds.length + selectedInteractionIds.length}
                  </span>
                )}
                <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>

              <div className="mt-3 space-y-3">
                {allDocuments.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t('tasks.linkedDocuments')} / {t('tasks.linkedPhotos')}
                    </p>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border p-1">
                      {allDocuments.map((d) => (
                        <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedDocumentIds.includes(String(d.id))}
                            onChange={() => toggleDocumentId(String(d.id))}
                            className="h-3.5 w-3.5"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{d.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{d.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {allInteractions.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t('tasks.linkedInteractions')}
                    </p>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border p-1">
                      {allInteractions.map((i) => (
                        <label key={i.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedInteractionIds.includes(i.id)}
                            onChange={() => toggleInteractionId(i.id)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{i.subject}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{i.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading || zonesLoading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
