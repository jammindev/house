import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { ChickenEvent, ChickenEventType } from '@/lib/api/chickens';

const TYPE_EMOJIS: Record<ChickenEventType, string> = {
  arrival: '🐣',
  care: '💊',
  illness: '🤒',
  broody: '🪺',
  molt: '🍂',
  predator: '🦊',
  death: '🖤',
  departure: '👋',
  other: '📌',
};

interface EventTimelineProps {
  events: ChickenEvent[];
  /** Show the hen's name on each entry (page-level journal). */
  showChicken?: boolean;
  onEdit: (event: ChickenEvent) => void;
  onDelete: (id: string) => void;
}

export default function EventTimeline({ events, showChicken = false, onEdit, onDelete }: EventTimelineProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const actions: CardAction[] = [
          { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(event) },
          { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(event.id), variant: 'danger' },
        ];
        return (
          <Card key={event.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {TYPE_EMOJIS[event.type]} {event.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`chickens.events.types.${event.type}`)} · {event.occurred_on}
                  {showChicken && event.chicken_name ? ` · ${event.chicken_name}` : ''}
                  {showChicken && !event.chicken_name ? ` · ${t('chickens.events.whole_flock')}` : ''}
                </p>
                {event.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>
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
