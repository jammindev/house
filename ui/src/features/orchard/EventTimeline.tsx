import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { TreeEvent } from '@/lib/api/orchard';

interface Props {
  events: TreeEvent[];
  onEdit?: (event: TreeEvent) => void;
  onDelete?: (id: string) => void;
  /** Show which subject the entry belongs to (orchard-wide journal). */
  showTree?: boolean;
}

export default function EventTimeline({ events, onEdit, onDelete, showTree }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const actions: CardAction[] = [];
        if (onEdit) {
          actions.push({ label: t('common.edit'), icon: Pencil, onClick: () => onEdit(event) });
        }
        if (onDelete) {
          actions.push({
            label: t('common.delete'),
            icon: Trash2,
            onClick: () => onDelete(event.id),
            variant: 'danger',
          });
        }

        return (
          <Card key={event.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t(`orchard.eventType.${event.type}`)}
                  </span>
                  <span className="text-sm font-medium text-foreground">{event.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{event.occurred_on}</span>
                  {showTree && event.tree_name ? <span>{event.tree_name}</span> : null}
                </div>
                {event.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {event.notes}
                  </p>
                ) : null}
              </div>
              {actions.length ? <CardActions actions={actions} /> : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
