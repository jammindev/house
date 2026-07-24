import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Clock, X } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Badge } from '@/design-system/badge';
import type { Briefing, BriefingSendStatus } from '@/lib/api/briefings';
import { useBriefingHistory } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefing?: Briefing;
}

const STATUS_ICON: Record<BriefingSendStatus, typeof Check> = {
  sent: Check,
  skipped_condition: X,
  error: AlertCircle,
};

const STATUS_VARIANT: Record<BriefingSendStatus, 'default' | 'secondary' | 'destructive'> = {
  sent: 'default',
  skipped_condition: 'secondary',
  error: 'destructive',
};

export default function BriefingHistoryDialog({ open, onOpenChange, briefing }: Props) {
  const { t, i18n } = useTranslation();
  const { data: entries = [], isLoading } = useBriefingHistory(briefing?.id, open);

  function formatWhen(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString(i18n.language, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('briefings.history.title')}>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <Clock className="h-6 w-6" />
          <p>{t('briefings.history.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const Icon = STATUS_ICON[entry.status];
            return (
              <li key={entry.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={STATUS_VARIANT[entry.status]} className="gap-1">
                    <Icon className="h-3 w-3" />
                    {t(`briefings.history.status.${entry.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatWhen(entry.created_at)}</span>
                </div>
                {entry.content ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    <span className="font-medium">
                      {entry.status === 'skipped_condition'
                        ? `${t('briefings.fields.condition')} : `
                        : `${t('briefings.history.contentLabel')} : `}
                    </span>
                    {entry.content}
                  </p>
                ) : null}
                {entry.user_name ? (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.user_name}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SheetDialog>
  );
}
