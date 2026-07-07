import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { buttonVariants } from '@/design-system/button';
import { useToast } from '@/lib/toast';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { Task } from '@/lib/api/tasks';
import { useMyWeekTasks, useSetTaskStatus } from './hooks';

function formatDay(dueDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' }).format(
    new Date(`${dueDate}T00:00:00`),
  );
}

export default function MyWeekCard() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { toast } = useToast();
  const { data: tasks = [], isLoading } = useMyWeekTasks();
  const setStatus = useSetTaskStatus();
  const showSkeleton = useDelayedLoading(isLoading);

  function completeTask(task: Task) {
    setStatus.mutate({ id: task.id, status: 'done' });
    toast({
      title: t('dashboard.myWeek.done', { subject: task.subject }),
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => setStatus.mutate({ id: task.id, status: 'pending' }),
      },
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{t('dashboard.myWeek.title')}</CardTitle>
        <Link to="/app/tasks" state={pushBack(location)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t('dashboard.myWeek.cta')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          {t('dashboard.myWeek.empty')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => completeTask(task)}
                disabled={setStatus.isPending}
                aria-label={t('dashboard.myWeek.markDone', { subject: task.subject })}
                className="group/check flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border transition-colors hover:border-primary hover:bg-primary/10"
              >
                <Check className="h-3 w-3 text-transparent transition-colors group-hover/check:text-primary" aria-hidden />
              </button>
              <Link
                to={`/app/tasks/${task.id}`}
                state={pushBack(location)}
                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
              >
                {task.priority === 1 ? (
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full bg-destructive"
                    title={t('tasks.priorityHigh')}
                  />
                ) : null}
                {task.subject}
              </Link>
              {task.due_date ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDay(task.due_date, i18n.language)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
