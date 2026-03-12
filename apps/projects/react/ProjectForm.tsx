import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import {
  createProject,
  fetchProject,
  fetchProjectGroups,
  updateProject,
  type ProjectGroupItem,
  type ProjectPayload,
  type ProjectStatus,
  type ProjectType,
} from '@/lib/api/projects';
import { fetchZones, type ZoneOption } from '@/lib/api/zones';

interface ProjectFormProps {
  mode: 'create' | 'edit';
  projectId?: string;
  cancelUrl?: string;
  successRedirectUrl?: string;
  onNavigate?: (url: string) => void;
}

const STATUS_OPTIONS: ProjectStatus[] = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];
const TYPE_OPTIONS: ProjectType[] = [
  'renovation', 'maintenance', 'repair', 'purchase',
  'relocation', 'vacation', 'leisure', 'other',
];
const PRIORITY_OPTIONS = [1, 2, 3, 4, 5];

type FormState = {
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  start_date: string;
  due_date: string;
  planned_budget: string;
  tags: string;
  project_group: string;
  zone_ids: string[];
};

const EMPTY_STATE: FormState = {
  title: '',
  description: '',
  status: 'draft',
  priority: '3',
  type: 'other',
  start_date: '',
  due_date: '',
  planned_budget: '',
  tags: '',
  project_group: '',
  zone_ids: [],
};

function toPayload(state: FormState): ProjectPayload {
  return {
    title: state.title.trim(),
    description: state.description,
    status: (state.status || 'draft') as ProjectStatus,
    priority: Number(state.priority) || 3,
    type: (state.type || 'other') as ProjectType,
    start_date: state.start_date || null,
    due_date: state.due_date || null,
    planned_budget: state.planned_budget ? Number(state.planned_budget) : 0,
    tags: state.tags.split(',').map((t) => t.trim()).filter(Boolean),
    project_group: state.project_group || null,
  };
}

export default function ProjectForm({
  mode,
  projectId,
  cancelUrl = '/app/projects/',
  successRedirectUrl = '/app/projects/',
  onNavigate,
}: ProjectFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [groups, setGroups] = React.useState<ProjectGroupItem[]>([]);
  const [zones, setZones] = React.useState<ZoneOption[]>([]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [loadedGroups, loadedZones, loadedProject] = await Promise.all([
          fetchProjectGroups(),
          fetchZones(),
          mode === 'edit' && projectId ? fetchProject(projectId) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setGroups(loadedGroups);
        setZones(loadedZones);
        if (loadedProject) {
          setForm({
            title: loadedProject.title || '',
            description: loadedProject.description || '',
            status: loadedProject.status || 'draft',
            priority: String(loadedProject.priority ?? 3),
            type: loadedProject.type || 'other',
            start_date: loadedProject.start_date || '',
            due_date: loadedProject.due_date || '',
            planned_budget: loadedProject.planned_budget ? String(Number(loadedProject.planned_budget)) : '',
            tags: (loadedProject.tags || []).join(', '),
            project_group: loadedProject.project_group || '',
            zone_ids: loadedProject.zones.map((z) => z.id),
          });
        }
      } catch {
        if (mounted) setError(t('projects.form.errors.load_failed'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [mode, projectId, t]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleZone(id: string) {
    setForm((prev) => ({
      ...prev,
      zone_ids: prev.zone_ids.includes(id)
        ? prev.zone_ids.filter((z) => z !== id)
        : [...prev.zone_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError(t('projects.form.errors.title_required'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = toPayload(form);
      let saved;
      if (mode === 'edit' && projectId) {
        saved = await updateProject(projectId, payload);
      } else {
        saved = await createProject(payload);
      }

      // Sync zones: delete removed, add new
      if (mode === 'create' && saved && form.zone_ids.length > 0) {
        await Promise.all(
          form.zone_ids.map((zoneId) =>
            fetch('/api/projects/project-zones/', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(getCsrf() ? { 'X-CSRFToken': getCsrf()! } : {}),
              },
              body: JSON.stringify({ project: saved.id, zone: zoneId }),
            })
          )
        );
      }

      const redirectUrl = successRedirectUrl.includes('{id}')
        ? successRedirectUrl.replace('{id}', saved.id)
        : successRedirectUrl;
      if (onNavigate) { onNavigate(redirectUrl); } else { window.location.assign(redirectUrl); }
    } catch {
      setError(mode === 'edit' ? t('projects.form.errors.update_failed') : t('projects.form.errors.create_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === 'edit' ? t('projects.form.title_edit') : t('projects.form.title_create');
  const submitLabel = mode === 'edit' ? t('projects.form.actions.save') : t('projects.form.actions.create');

  return (
    <>
      <PageHeader title={title} />
      <Card>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">{t('projects.loading')}</p> : null}

        {!loading ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t('projects.form.error')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1">
              <label htmlFor="proj-title" className="text-sm font-medium">{t('projects.form.fields.title')} *</label>
              <Input id="proj-title" value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </div>

            <div className="space-y-1">
              <label htmlFor="proj-description" className="text-sm font-medium">{t('projects.form.fields.description')}</label>
              <Textarea id="proj-description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="proj-status" className="text-sm font-medium">{t('projects.form.fields.status')}</label>
                <Select id="proj-status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t(`projects.status.${s}`)}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="proj-type" className="text-sm font-medium">{t('projects.form.fields.type')}</label>
                <Select id="proj-type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {TYPE_OPTIONS.map((tp) => (
                    <option key={tp} value={tp}>{t(`projects.type.${tp}`)}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="proj-priority" className="text-sm font-medium">{t('projects.form.fields.priority')}</label>
                <Select id="proj-priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={String(p)}>{p}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="proj-start" className="text-sm font-medium">{t('projects.form.fields.start_date')}</label>
                <Input id="proj-start" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="proj-due" className="text-sm font-medium">{t('projects.form.fields.due_date')}</label>
                <Input id="proj-due" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="proj-budget" className="text-sm font-medium">{t('projects.form.fields.planned_budget')}</label>
                <Input id="proj-budget" type="number" step="0.01" min="0" value={form.planned_budget} onChange={(e) => set('planned_budget', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="proj-group" className="text-sm font-medium">{t('projects.form.fields.project_group')}</label>
                <Select id="proj-group" value={form.project_group} onChange={(e) => set('project_group', e.target.value)}>
                  <option value="">{t('projects.form.no_group')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="proj-tags" className="text-sm font-medium">{t('projects.form.fields.tags')}</label>
                <Input id="proj-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder={t('projects.form.tags_placeholder')} />
              </div>
            </div>

            {zones.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('projects.form.fields.zones')}</p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((zone) => {
                    const selected = form.zone_ids.includes(zone.id);
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => toggleZone(zone.id)}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {zone.full_path || zone.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? t('projects.form.actions.saving') : submitLabel}
              </Button>
              <a
                href={cancelUrl}
                onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate(cancelUrl); } : undefined}
                className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                {t('projects.form.actions.cancel')}
              </a>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
    </>
  );
}

function getCsrf(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith('csrftoken='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}
