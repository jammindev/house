import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import {
  createProject,
  updateProject,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectType,
} from '@/lib/api/projects';
import { useZones, useProjectGroups } from './hooks';

const STATUS_OPTIONS: ProjectStatus[] = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];
const TYPE_OPTIONS: ProjectType[] = [
  'renovation', 'maintenance', 'repair', 'purchase',
  'relocation', 'vacation', 'leisure', 'other',
];

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingProject?: ProjectListItem;
}

export default function ProjectDialog({
  open,
  onOpenChange,
  onSaved,
  existingProject,
}: ProjectDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingProject);

  const { data: zones = [] } = useZones();
  const { data: groups = [] } = useProjectGroups();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<ProjectStatus>('draft');
  const [type, setType] = React.useState<ProjectType>('other');
  const [groupId, setGroupId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [plannedBudget, setPlannedBudget] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(existingProject?.title ?? '');
    setDescription(existingProject?.description ?? '');
    setStatus((existingProject?.status ?? 'draft') as ProjectStatus);
    setType((existingProject?.type ?? 'other') as ProjectType);
    setGroupId(existingProject?.project_group ?? '');
    setStartDate(existingProject?.start_date ?? '');
    setDueDate(existingProject?.due_date ?? '');
    setPlannedBudget(
      existingProject?.planned_budget ? String(Number(existingProject.planned_budget)) : '',
    );
    setError(null);
  }, [open, existingProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('projects.form.errors.title_required'));
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description,
      status,
      type,
      project_group: groupId || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      planned_budget: plannedBudget ? Number(plannedBudget) : 0,
    };

    const action =
      isEditing && existingProject
        ? updateProject(existingProject.id, payload)
        : createProject(payload);

    action
      .then(() => {
        setLoading(false);
        onOpenChange(false);
        onSaved();
      })
      .catch(() => {
        setLoading(false);
        setError(
          isEditing
            ? t('projects.form.errors.update_failed')
            : t('projects.form.errors.create_failed'),
        );
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('projects.form.title_edit') : t('projects.form.title_create')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          {/* Title */}
          <FormField label={`${t('projects.form.fields.title')} *`} htmlFor="proj-title">
            <Input
              id="proj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoComplete="off"
            />
          </FormField>

          {/* Description */}
          <FormField label={t('projects.form.fields.description')} htmlFor="proj-description">
            <Textarea
              id="proj-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          {/* Status + Type */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('projects.form.fields.status')} htmlFor="proj-status">
              <Select
                id="proj-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`projects.status.${s}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('projects.form.fields.type')} htmlFor="proj-type">
              <Select
                id="proj-type"
                value={type}
                onChange={(e) => setType(e.target.value as ProjectType)}
              >
                {TYPE_OPTIONS.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(`projects.type.${tp}`)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {/* Zone select (first zone of existing project) — simplified: group only */}
          {groups.length > 0 ? (
            <FormField label={t('projects.form.fields.project_group')} htmlFor="proj-group">
              <Select
                id="proj-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">{t('projects.form.no_group')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {/* Zone chips (read-only indicator when editing) */}
          {zones.length > 0 && !isEditing ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">{t('projects.form.fields.zones')}</p>
              <p className="text-xs text-muted-foreground">{t('projects.zones_edit_note')}</p>
            </div>
          ) : null}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('projects.form.fields.start_date')} htmlFor="proj-start">
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField label={t('projects.form.fields.due_date')} htmlFor="proj-due">
              <Input
                id="proj-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>
          </div>

          {/* Budget */}
          <FormField label={t('projects.form.fields.planned_budget')} htmlFor="proj-budget">
            <Input
              id="proj-budget"
              type="number"
              step="0.01"
              min="0"
              value={plannedBudget}
              onChange={(e) => setPlannedBudget(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
