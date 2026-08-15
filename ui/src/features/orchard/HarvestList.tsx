import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatQuantity } from '@/lib/format';
import type { Harvest } from '@/lib/api/orchard';

interface Props {
  harvests: Harvest[];
  onEdit: (harvest: Harvest) => void;
  onDelete: (id: string) => void;
}

export default function HarvestList({ harvests, onEdit, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {harvests.map((harvest) => {
        const actions: CardAction[] = [
          { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(harvest) },
          {
            label: t('common.delete'),
            icon: Trash2,
            onClick: () => onDelete(harvest.id),
            variant: 'danger',
          },
        ];

        return (
          <Card key={harvest.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {formatQuantity(harvest.quantity)} {t(`orchard.unit.${harvest.unit}`)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{harvest.harvested_on}</p>
                {harvest.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {harvest.notes}
                  </p>
                ) : null}
              </div>
              <CardActions actions={actions} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
