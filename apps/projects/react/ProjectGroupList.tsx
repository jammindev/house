import * as React from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import {
  fetchProjectGroups,
  createProjectGroup,
  deleteProjectGroup,
  type ProjectGroupItem,
} from '@/lib/api/projects';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface ProjectGroupListProps {
  projectsUrl?: string;
}

export default function ProjectGroupList({
  projectsUrl = '/app/projects/',
}: ProjectGroupListProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [groups, setGroups] = React.useState<ProjectGroupItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Inline create form
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchProjectGroups(householdId);
      setGroups(items);
    } catch {
      setError(t('projects.groups.error_loading'));
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  React.useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(t('projects.groups.name_required'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createProjectGroup({ name: name.trim(), description }, householdId);
      setGroups((prev) => [...prev, created]);
      setName('');
      setDescription('');
      setShowForm(false);
    } catch {
      setFormError(t('projects.groups.create_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group: ProjectGroupItem) {
    if (!window.confirm(t('projects.groups.delete_confirm', { name: group.name }))) return;
    setDeletingId(group.id);
    try {
      await deleteProjectGroup(group.id, householdId);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t('projects.groups.title', { defaultValue: 'Project groups' })}
      >
        <a
          href={projectsUrl}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t('projects.groups.back', { defaultValue: '← Projects' })}
        </a>
      </PageHeader>
    <Card>
      <CardHeader>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? t('projects.groups.cancel') : t('projects.groups.new')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form className="rounded-lg border p-4 space-y-3" onSubmit={handleCreate}>
            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="grp-name" className="text-sm font-medium">{t('projects.groups.form.name')} *</label>
              <Input id="grp-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="grp-desc" className="text-sm font-medium">{t('projects.groups.form.description')}</label>
              <Textarea id="grp-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t('projects.groups.form.saving') : t('projects.groups.form.create')}
            </Button>
          </form>
        ) : null}

        {loading ? <p className="text-sm text-muted-foreground">{t('projects.loading')}</p> : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>{t('projects.unable_to_load')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('projects.groups.empty')}</p>
        ) : null}

        {!loading && !error && groups.length > 0 ? (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li key={group.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/app/projects/groups/${group.id}/`}
                      className="font-medium text-sm underline underline-offset-2 hover:text-foreground"
                    >
                      {group.name}
                    </a>
                    {group.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{group.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{group.projects_count} proj.</span>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDelete(group)}
                      disabled={deletingId === group.id}
                      className="h-6 px-2 text-xs"
                    >
                      {t('projects.delete')}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
    </>
  );
}
