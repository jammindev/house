import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { pushBack } from '@/lib/backNavigation';
import type { Tree, TreeStatus } from '@/lib/api/orchard';

const STATUS_TONE: Record<TreeStatus, string> = {
  alive: 'bg-primary/10 text-primary',
  ailing: 'bg-destructive/10 text-destructive',
  dead: 'bg-muted text-muted-foreground',
  removed: 'bg-muted text-muted-foreground',
};

export function TreeStatusBadge({ status }: { status: TreeStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}
    >
      {t(`orchard.status.${status}`)}
    </span>
  );
}

interface Props {
  tree: Tree;
  onEdit: (tree: Tree) => void;
  onDelete: (id: string) => void;
}

export default function TreeCard({ tree, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const location = useLocation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(tree) },
    {
      label: t('common.delete'),
      icon: Trash2,
      onClick: () => onDelete(tree.id),
      variant: 'danger',
    },
  ];

  // The two facts a household actually reads on a card: what it is, and how old.
  const subtitle = [
    tree.species,
    tree.age_years !== null ? t('orchard.card.age', { count: tree.age_years }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/app/orchard/${tree.id}`}
            state={pushBack(location)}
            className="group text-foreground hover:text-primary"
          >
            <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">
              {tree.name}
            </CardTitle>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t(`orchard.kind.${tree.kind}`)}</span>
            {subtitle ? <span>{subtitle}</span> : null}
            {tree.status !== 'alive' ? <TreeStatusBadge status={tree.status} /> : null}
          </div>
        </div>
        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
