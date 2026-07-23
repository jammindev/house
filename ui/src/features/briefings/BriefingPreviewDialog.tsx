import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertCircle, Send } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { useTelegramStatus } from '@/features/settings/hooks';
import type { Briefing } from '@/lib/api/briefings';
import { usePreviewBriefing, useSendBriefingNow } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefing?: Briefing;
}

export default function BriefingPreviewDialog({ open, onOpenChange, briefing }: Props) {
  const { t } = useTranslation();
  const preview = usePreviewBriefing();
  const send = useSendBriefingNow();
  const { data: telegram } = useTelegramStatus();

  const { reset: resetPreview, mutate: runPreview } = preview;

  // Generate the content once each time the dialog opens for a briefing.
  React.useEffect(() => {
    if (!open || !briefing) return;
    resetPreview();
    runPreview(briefing.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, briefing?.id]);

  async function handleSend() {
    if (!briefing) return;
    await send.mutateAsync(briefing.id);
    onOpenChange(false);
  }

  const text = preview.data?.text ?? '';
  const telegramLinked = telegram?.linked ?? true; // don't nag before status loads

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('briefings.preview.title')}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('briefings.preview.description')}</p>

        {preview.isPending ? (
          <div className="space-y-2" aria-live="polite">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : preview.isError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p>{t('briefings.preview.failed')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => briefing && preview.mutate(briefing.id)}
              >
                {t('common.retry')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
            {text || t('briefings.preview.empty')}
          </div>
        )}

        {!telegramLinked ? (
          <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t('briefings.preview.linkFirst')}{' '}
              <Link to="/app/settings" className="text-primary underline">
                {t('briefings.preview.linkCta')}
              </Link>
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button
            type="button"
            className="gap-1"
            disabled={preview.isPending || send.isPending || !telegramLinked}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
            {t('briefings.send.button')}
          </Button>
        </div>
      </div>
    </SheetDialog>
  );
}
