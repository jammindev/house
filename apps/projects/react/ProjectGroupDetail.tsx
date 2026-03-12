import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import {
  fetchProjectGroup,
  updateProjectGroup,
  deleteProjectGroup,
  type ProjectGroupItem,
} from '@/lib/api/projects';
import ProjectList from './ProjectList';

interface ProjectGroupDetailProps {
  groupId: string;
  backUrl?: string;
  editUrl?: string | null;
  onNavigate?: (url: string) => void;
}

export default function ProjectGroupDetail({
  groupId,
  backUrl = '/app/projects/groups/',
  onNavigate,
}: ProjectGroupDetailProps) {
  const { t } = useTranslation();
  const [group, setGroup] = React.useState<ProjectGroupItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchProjectGroup(groupId);
        if (!mounted) return;
        setGroup(item);
        setName(item.name);
        setDescription(item.description);
      } catch {
        if (mounted) setError(t('projects.groups.error_loading'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [groupId, t]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setSaveError(t('projects.groups.name_required')); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateProjectGroup(groupId, { name: name.trim(), description });
      setGroup(updated);
      setEditing(false);
    } catch {
      setSaveError(t('projects.groups.update_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!group) return;
    if (!window.confirm(t('projects.groups.delete_confirm', { name: group.name }))) return;
    setDeleting(true);
    try {
      await deleteProjectGroup(groupId);
      if (onNavigate) { onNavigate(backUrl); } else { window.location.assign(backUrl); }
    } catch {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('projects.loading')}</p>;
  if (error) return (
    <Alert variant="destructive">
      <AlertTitle>{t('projects.unable_to_load')}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  if (!group) return null;

  return (
    <div className="space-y-6">
      {/* Group header */}
      <Card>
        <CardContent className="pt-4">
          {!editing ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{group.name}</h2>
                {group.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">{group.projects_count} {t('projects.groups.projects_count')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setEditing(true)} className="h-8 px-3 text-sm">
                  {t('projects.edit')}
                </Button>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting} className="h-8 px-3 text-sm">
                  {deleting ? t('projects.deleting') : t('projects.delete')}
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handleSave}>
              {saveError ? (
                <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>
              ) : null}
              <div className="space-y-1">
                <label htmlFor="grpd-name" className="text-sm font-medium">{t('projects.groups.form.name')} *</label>
                <Input id="grpd-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label htmlFor="grpd-desc" className="text-sm font-medium">{t('projects.groups.form.description')}</label>
                <Textarea id="grpd-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? t('projects.form.actions.saving') : t('projects.form.actions.save')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  {t('projects.form.actions.cancel')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Projects filtered by group */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">{t('projects.title')}</h3>
        <ProjectList
          initialGroupId={groupId}
        />
      </div>
    </div>
  );
}
