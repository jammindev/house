import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import type { InteractionListItem } from '@/lib/api/interactions';

interface InteractionCardProps {
  item: InteractionListItem;
  onDelete: (id: string) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function InteractionCard({ item, onDelete }: InteractionCardProps) {
  const { t } = useTranslation();

  const typeLabelKey = `equipment.interaction_type.${item.type}`;
  const statusLabelKey = item.status ? `equipment.interaction_status.${item.status}` : null;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.subject}</p>
            <Badge variant="outline">{t(typeLabelKey, { defaultValue: item.type })}</Badge>
            {statusLabelKey ? (
              <Badge variant="secondary">
                {t(statusLabelKey, { defaultValue: item.status ?? '' })}
              </Badge>
            ) : null}
          </div>

          {item.content ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
          ) : null}

          {(item.zone_names.length > 0 || item.document_count > 0 || item.tags.length > 0) ? (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {item.zone_names.length > 0 ? (
                <span>
                  {t('interactions.meta_zones')}: {item.zone_names.join(', ')}
                </span>
              ) : null}
              {item.document_count > 0 ? (
                <span>
                  {t('interactions.meta_documents', { count: item.document_count })}
                </span>
              ) : null}
              {item.tags.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}

          <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.occurred_at)}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(item.id)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
