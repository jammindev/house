import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ExternalLink, GraduationCap, RotateCcw } from 'lucide-react';

import { Card } from '@/design-system/card';
import { Button, buttonVariants } from '@/design-system/button';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import BackLink from '@/components/BackLink';
import { cn } from '@/lib/utils';
import { findGuide, GUIDE_ICONS, guideDoneKey } from './content';
import { useCompletedTutorials, useToggleTutorial } from './hooks';

export default function TutorialGuidePage() {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const guide = findGuide(key);
  const { completed } = useCompletedTutorials();
  const { toggle } = useToggleTutorial();

  if (!guide) {
    return (
      <div>
        <div className="mb-4">
          <BackLink fallback="/app/tutorial" fallbackLabel={t('tutorials.title')} />
        </div>
        <EmptyState icon={GraduationCap} title={t('tutorials.notFound')} />
      </div>
    );
  }

  const doneKey = guideDoneKey(guide.key);
  const isDone = completed.has(doneKey);
  const Icon = GUIDE_ICONS[guide.key];

  return (
    <div>
      <div className="mb-4">
        <BackLink fallback="/app/tutorial" fallbackLabel={t('tutorials.title')} />
      </div>

      <PageHeader
        title={t(`tutorials.guide.${guide.key}.title`)}
        description={t(`tutorials.guide.${guide.key}.intro`)}
      >
        <Link to={guide.to} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          {t('tutorials.openPage')}
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
        </Link>
      </PageHeader>

      <ol className="space-y-2">
        {guide.stepIds.map((stepId, index) => (
          <li key={stepId}>
            <Card className="flex gap-3 p-4">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {t(`tutorials.guide.${guide.key}.steps.${stepId}.title`)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`tutorials.guide.${guide.key}.steps.${stepId}.body`)}
                </p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-center gap-3">
        <Button
          type="button"
          variant={isDone ? 'outline' : 'default'}
          onClick={() => toggle(doneKey)}
        >
          {isDone ? (
            <>
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
              {t('tutorials.markUndone')}
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
              {t('tutorials.markDone')}
            </>
          )}
        </Button>
        {isDone ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {t('tutorials.done')}
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Link to={guide.to} className="text-sm text-muted-foreground hover:text-primary hover:underline">
          {t('tutorials.openPageLong')}
        </Link>
      </div>
    </div>
  );
}
