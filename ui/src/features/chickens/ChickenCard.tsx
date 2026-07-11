import { Link, useLocation } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { pushBack } from '@/lib/backNavigation';
import type { Chicken, ChickenStatus } from '@/lib/api/chickens';

const STATUS_CLASSES: Record<ChickenStatus, string> = {
  active: 'bg-primary/10 text-primary',
  broody: 'bg-muted text-muted-foreground',
  sick: 'bg-destructive/10 text-destructive',
  deceased: 'bg-muted text-muted-foreground',
  gone: 'bg-muted text-muted-foreground',
};

export function ChickenStatusBadge({ status }: { status: ChickenStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {t(`chickens.status.${status}`)}
    </span>
  );
}

interface ChickenCardProps {
  chicken: Chicken;
  onEdit: (chicken: Chicken) => void;
  onDelete: (id: string) => void;
}

export default function ChickenCard({ chicken, onEdit, onDelete }: ChickenCardProps) {
  const { t } = useTranslation();
  const location = useLocation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(chicken) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(chicken.id), variant: 'danger' },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/app/chickens/${chicken.id}`}
              state={pushBack(location)}
              className="group text-foreground hover:text-primary"
            >
              <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">
                {`🐔 ${chicken.name}`}
              </CardTitle>
            </Link>
            <ChickenStatusBadge status={chicken.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {[chicken.breed, chicken.color].filter(Boolean).join(' · ') || t('chickens.no_details')}
          </p>
        </div>
        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
