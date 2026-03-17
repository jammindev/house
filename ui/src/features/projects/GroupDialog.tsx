import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { createProjectGroup, updateProjectGroup, type ProjectGroupItem } from '@/lib/api/projects';

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingGroup?: ProjectGroupItem;
}

export default function GroupDialog({
  open,
  onOpenChange,
  onSaved,
  existingGroup,
}: GroupDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingGroup);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(existingGroup?.name ?? '');
    setDescription(existingGroup?.description ?? '');
    setError(null);
  }, [open, existingGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('projects.groups.name_required'));
      return;
    }
    setLoading(true);
    setError(null);

    const action =
      isEditing && existingGroup
        ? updateProjectGroup(existingGroup.id, { name: name.trim(), description })
        : createProjectGroup({ name: name.trim(), description });

    action
      .then(() => {
        setLoading(false);
        onOpenChange(false);
        onSaved();
      })
      .catch(() => {
        setLoading(false);
        setError(
          isEditing ? t('projects.groups.update_failed') : t('projects.groups.create_failed'),
        );
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('projects.groups.edit_title') : t('projects.groups.new')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="grp-name">
              {t('projects.groups.form.name')} *
            </label>
            <Input
              id="grp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="grp-desc">
              {t('projects.groups.form.description')}
            </label>
            <Textarea
              id="grp-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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
