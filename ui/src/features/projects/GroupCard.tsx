import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { ProjectGroupItem } from '@/lib/api/projects';

interface GroupCardProps {
  group: ProjectGroupItem;
  onEdit: (group: ProjectGroupItem) => void;
  onDelete: (groupId: string) => void;
}

export default function GroupCard({ group, onEdit, onDelete }: GroupCardProps) {
  const { t } = useTranslation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(group) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(group.id), variant: 'danger' },
  ];

  return (
    <Card className="p-3 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{group.name}</p>
          {group.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {group.description}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {group.projects_count} {t('projects.groups.projects_count')}
          </p>
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
