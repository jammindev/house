import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { createTask, fetchZones, updateTask, type Zone, type Task } from '@/lib/api/tasks';
import { useHouseholdId } from '@/lib/useHouseholdId';

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  existingTask?: Task;
  onUpdated?: (task: Task) => void;
}

export default function NewTaskDialog({
  open,
  onOpenChange,
  onCreated,
  existingTask,
  onUpdated,
}: NewTaskDialogProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const isEditing = Boolean(existingTask);

  const [subject, setSubject] = React.useState('');
  const [content, setContent] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadZones = React.useCallback(() => {
    setZonesLoading(true);
    fetchZones(householdId)
      .then((list) => {
        setZones(list);
        setZonesLoading(false);
      })
      .catch(() => setZonesLoading(false));
  }, [householdId]);

  // Préremplissage quand la dialog s'ouvre
  React.useEffect(() => {
    if (!open) return;
    if (existingTask) {
      setSubject(existingTask.subject || '');
      setContent(existingTask.content || '');
      setOccurredAt(existingTask.occurred_at ? existingTask.occurred_at.split('T')[0] : '');
    } else {
      setSubject('');
      setContent('');
      setOccurredAt('');
      setZoneId('');
    }
    setError(null);
    loadZones();
  }, [open, existingTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sélection de zone une fois les zones chargées
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

    if (isEditing && existingTask) {
      updateTask(
        existingTask.id,
        {
          subject,
          content: content || undefined,
          occurred_at: occurredAt ? `${occurredAt}T12:00:00` : undefined,
          zone_ids: [zoneId],
        },
        householdId,
      )
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
      createTask(
        {
          subject,
          content: content || undefined,
          occurred_at: occurredAt ? `${occurredAt}T12:00:00` : undefined,
          zone_ids: [zoneId],
        },
        householdId,
      )
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

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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
                  ? t('tasks.loadingZones', { defaultValue: 'Loading zones…' })
                  : t('tasks.selectZone', { defaultValue: 'Select a zone' })
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="task-date">
              {t('tasks.fieldDate', { defaultValue: 'Due date' })}
            </label>
            <Input
              id="task-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
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
