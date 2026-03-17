import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import type { ProjectGroupItem } from '@/lib/api/projects';

interface GroupCardProps {
  group: ProjectGroupItem;
  onEdit: (group: ProjectGroupItem) => void;
  onDelete: (groupId: string) => void;
}

export default function GroupCard({ group, onEdit, onDelete }: GroupCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{group.name}</p>
          {group.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {group.description}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {group.projects_count} {t('projects.groups.projects_count')}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(group.id)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(group)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
