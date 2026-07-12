import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';

import { Card, CardTitle } from '@/design-system/card';
import PageHeader from '@/components/PageHeader';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { pushBack } from '@/lib/backNavigation';
import { GUIDE_ICONS, guideDoneKey, startDoneKey, type TutorialGuide } from './content';
import { useCompletedTutorials, useToggleTutorial, useVisibleTutorials } from './hooks';

export default function TutorialsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { guides, startItems, isLoading: modulesLoading } = useVisibleTutorials();
  const { completed, isLoading: progressLoading } = useCompletedTutorials();
  const { toggle } = useToggleTutorial();

  const showSkeleton = useDelayedLoading(modulesLoading || progressLoading);
  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const allKeys = [
    ...startItems.map((i) => startDoneKey(i.key)),
    ...guides.map((g) => guideDoneKey(g.key)),
  ];
  const doneCount = allKeys.filter((k) => completed.has(k)).length;
  const percent = allKeys.length > 0 ? Math.round((doneCount / allKeys.length) * 100) : 0;

  return (
    <div>
      <PageHeader title={t('tutorials.title')} description={t('tutorials.description')} />

      {/* Progression globale */}
      <Card className="mb-6 p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">{t('tutorials.progressTitle')}</span>
          <span className="text-muted-foreground">
            {t('tutorials.progressCount', { done: doneCount, total: allKeys.length })}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </Card>

      {/* Bien démarrer */}
      <section className="mb-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">{t('tutorials.gettingStarted')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('tutorials.gettingStartedHint')}</p>
        <Card className="divide-y divide-border">
          {startItems.map((item) => {
            const doneKey = startDoneKey(item.key);
            const isDone = completed.has(doneKey);
            return (
              <div key={item.key} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => toggle(doneKey)}
                  aria-pressed={isDone}
                  aria-label={isDone ? t('tutorials.markUndone') : t('tutorials.markDone')}
                  title={isDone ? t('tutorials.markUndone') : t('tutorials.markDone')}
                  className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-primary"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {t(`tutorials.start.items.${item.key}.title`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`tutorials.start.items.${item.key}.description`)}
                  </p>
                </div>
                <Link
                  to={item.to}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t('tutorials.goThere')}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            );
          })}
        </Card>
      </section>

      {/* Guides */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-foreground">{t('tutorials.guides')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('tutorials.guidesHint')}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <GuideCard
              key={guide.key}
              guide={guide}
              isDone={completed.has(guideDoneKey(guide.key))}
              backState={pushBack(location)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function GuideCard({
  guide,
  isDone,
  backState,
}: {
  guide: TutorialGuide;
  isDone: boolean;
  backState: ReturnType<typeof pushBack>;
}) {
  const { t } = useTranslation();
  const Icon = GUIDE_ICONS[guide.key];
  return (
    <Link to={`/app/tutorial/${guide.key}`} state={backState} className="group">
      <Card className="h-full p-3 transition-colors group-hover:border-primary/40">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="[&>span:last-child]:group-hover:underline">
              {t(`tutorials.guide.${guide.key}.title`)}
            </CardTitle>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {t(`tutorials.guide.${guide.key}.intro`)}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {t('tutorials.stepCount', { count: guide.stepIds.length })}
              {isDone ? (
                <span className="inline-flex items-center gap-0.5 font-medium text-primary">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  {t('tutorials.done')}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
