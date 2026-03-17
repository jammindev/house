import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import {
  createTask, fetchZones, updateTask,
  type Zone, type Task, type HouseholdMember, type TaskPriority,
} from '@/lib/api/tasks';

const PRIORITY_OPTIONS = [
  { value: '1', label: 'Haute' },
  { value: '2', label: 'Normale' },
  { value: '3', label: 'Basse' },
];

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  existingTask?: Task;
  onUpdated?: (task: Task) => void;
  householdMembers?: HouseholdMember[];
}

export default function NewTaskDialog({
  open,
  onOpenChange,
  onCreated,
  existingTask,
  onUpdated,
  householdMembers = [],
}: NewTaskDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingTask);

  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState<string>('2');
  const [assignedToId, setAssignedToId] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadZones = React.useCallback(() => {
    setZonesLoading(true);
    fetchZones()
      .then((list) => {
        setZones(list);
        setZonesLoading(false);
      })
      .catch(() => setZonesLoading(false));
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (existingTask) {
      setSubject(existingTask.subject || '');
      setContent(existingTask.content || '');
      setDueDate(existingTask.due_date ?? '');
      setPriority(String(existingTask.priority ?? 2));
      setAssignedToId(existingTask.assigned_to ?? '');
    } else {
      setSubject('');
      setContent('');
      setDueDate('');
      setPriority('2');
      setAssignedToId('');
      setZoneId('');
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
      setError(t('tasks.zoneRequired', { defaultValue: 'Please select a zone.' }));
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
          setError(t('tasks.updateFailed', { defaultValue: 'Failed to update task.' }));
        });
    } else {
      createTask(payload)
        .then(() => {
          setLoading(false);
          onOpenChange(false);
          onCreated();
        })
        .catch(() => {
          setLoading(false);
          setError(t('tasks.createFailed', { defaultValue: 'Failed to create task.' }));
        });
    }
  };

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.name }));
  const memberOptions = householdMembers.map((m) => ({ value: m.userId, label: m.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('tasks.editTitle', { defaultValue: 'Edit task' })
              : t('tasks.newTask', { defaultValue: 'New task' })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="task-subject">
              {t('tasks.fieldSubject', { defaultValue: 'Subject' })}
            </label>
            <Input
              id="task-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              autoComplete="off"
              placeholder={t('tasks.fieldSubjectPlaceholder', { defaultValue: 'Task title…' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="task-zone">
                {t('tasks.fieldZone', { defaultValue: 'Zone' })}
              </label>
              <Select
                id="task-zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                options={zoneOptions}
                placeholder={
                  zonesLoading
                    ? t('tasks.loadingZones', { defaultValue: 'Loading…' })
                    : t('tasks.selectZone', { defaultValue: 'Select a zone' })
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="task-priority">
                {t('tasks.fieldPriority', { defaultValue: 'Priority' })}
              </label>
              <Select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={PRIORITY_OPTIONS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="task-date">
                {t('tasks.fieldDate', { defaultValue: 'Due date' })}
              </label>
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {memberOptions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="task-assigned">
                  {t('tasks.fieldAssignedTo', { defaultValue: 'Assign to' })}
                </label>
                <Select
                  id="task-assigned"
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  options={memberOptions}
                  placeholder={t('tasks.noAssignee', { defaultValue: 'No assignee' })}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="task-content">
              {t('tasks.fieldContent', { defaultValue: 'Notes' })}
            </label>
            <Textarea
              id="task-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={t('tasks.fieldContentPlaceholder', { defaultValue: 'Optional notes…' })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={loading || zonesLoading}>
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
