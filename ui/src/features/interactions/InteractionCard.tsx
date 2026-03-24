import { Pencil, Trash2, ListTodo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
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
  const navigate = useNavigate();

  const typeLabelKey = `equipment.interaction_type.${item.type}`;
  const statusLabelKey = item.status ? `equipment.interaction_status.${item.status}` : null;

  return (
    <Card className="p-3 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{item.subject}</CardTitle>
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
                      className="rounded-full bg-muted px-1.5 py-0.5 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}

          {item.project && item.project_title ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <span>{t('interactions.project_label')}: </span>
              <a
                href={`/app/projects/${item.project}`}
                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {item.project_title}
              </a>
            </div>
          ) : null}

          <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.occurred_at)}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          {item.type !== 'todo' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(`/app/interactions/new?type=todo`)}
              aria-label={t('interactions.createTask')}
              title={t('interactions.createTask')}
              type="button"
            >
              <ListTodo className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/app/interactions/${item.id}/edit`)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
