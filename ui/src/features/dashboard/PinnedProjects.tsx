import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { buttonVariants } from '@/design-system/button';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useActiveProjects } from './hooks';

export default function PinnedProjects() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { data: projects = [], isLoading } = useActiveProjects();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <Card className="p-4">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (projects.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{t('dashboard.projects.title')}</CardTitle>
        <Link
          to="/app/projects"
          state={pushBack(location)}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {t('dashboard.projects.cta')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="space-y-1">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/app/projects/${project.id}`}
            state={pushBack(location)}
            className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50"
          >
            <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {project.title}
            </span>
            {project.due_date ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                  new Date(`${project.due_date}T00:00:00`),
                )}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </Card>
  );
}
