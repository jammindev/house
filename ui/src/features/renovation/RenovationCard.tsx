import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Layers } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { InteractionListItem } from '@/lib/api/interactions';
import type { RenovationElement, RenovationType } from '@/lib/api/renovation';

interface RenovationCardProps {
  entry: InteractionListItem;
  onEdit: (entry: InteractionListItem) => void;
  onDelete: (entry: InteractionListItem) => void;
}

export default function RenovationCard({ entry, onEdit, onDelete }: RenovationCardProps) {
  const { t } = useTranslation();
  const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
  const element = (metadata.element as RenovationElement) || 'other';
  const product = (metadata.product as string) || '';
  const brand = (metadata.brand as string) || '';
  const reference = (metadata.reference as string) || '';
  const type = entry.type as RenovationType;

  // Product line: "product · brand · ref XYZ" — only the parts that exist.
  const details: string[] = [];
  if (product) details.push(product);
  if (brand) details.push(brand);
  if (reference) details.push(t('renovation.card.ref', { reference }));

  const extraZones = Math.max(0, (entry.zone_names?.length ?? 0) - 1);

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(entry) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(entry), variant: 'danger' },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t(`renovation.elements.${element}`)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t(`renovation.types.${type}`)}
            </span>
            {extraZones > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Layers className="h-3 w-3" />
                {t('renovation.card.moreZones', { count: extraZones })}
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 truncate text-sm font-medium text-foreground">{entry.subject}</p>

          {details.length > 0 ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{details.join(' · ')}</p>
          ) : null}

          {entry.content ? (
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {entry.content}
            </p>
          ) : null}

          <p className="mt-1 text-xs text-muted-foreground">
            {entry.occurred_at ? new Date(entry.occurred_at).toLocaleDateString() : null}
          </p>
        </div>
        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
