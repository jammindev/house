import * as React from 'react';
import { Sparkles, ExternalLink, Rocket, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/design-system/badge';
import { Card } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { useAuth } from '@/lib/auth/useAuth';
import { prUrl, type ChangeType, type ChangelogEntry } from '@/lib/api/changelog';
import { useChangelog, useChangelogState } from './hooks';

const TYPE_VARIANT: Record<ChangeType, 'default' | 'secondary' | 'outline'> = {
  feat: 'default',
  fix: 'secondary',
  perf: 'outline',
};

export default function ChangelogPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: entries, isLoading } = useChangelog();
  const { data: state } = useChangelogState();
  const [activeModule, setActiveModule] = useSessionState<string>('changelog.module', 'all');

  const showSkeleton = useDelayedLoading(isLoading);

  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }),
    [i18n.language],
  );

  // Modules présents, triés par fréquence décroissante — alimente les filtres.
  const modules = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries ?? []) counts.set(e.module, (counts.get(e.module) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  }, [entries]);

  const filtered = React.useMemo(() => {
    if (!entries) return [];
    if (activeModule === 'all') return entries;
    return entries.filter((e) => e.module === activeModule);
  }, [entries, activeModule]);

  // Réservé au staff — garde-fou UX (le backend renvoie 403 de toute façon).
  if (user && !user.is_staff) {
    return (
      <div>
        <PageHeader title={t('changelog.title')} description={t('changelog.description')} />
        <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
          {t('changelog.adminOnly')}
        </Card>
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const isEmpty = !entries || entries.length === 0;

  return (
    <div>
      <PageHeader title={t('changelog.title')} description={t('changelog.description')} />

      {state ? (
        <Card className="mb-4 flex items-center gap-3 p-3">
          <Rocket className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 text-sm">
            <span className="font-medium text-foreground">{t('changelog.liveTitle')}</span>{' '}
            <span className="text-muted-foreground">
              {t('changelog.liveSubtitle', {
                date: dateFmt.format(new Date(state.head_committed_at)),
                sha: state.head_sha.slice(0, 7),
              })}
            </span>
          </div>
        </Card>
      ) : null}

      {isEmpty ? (
        <EmptyState icon={Sparkles} title={t('changelog.empty')} />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 pb-4">
            <FilterPill active={activeModule === 'all'} onClick={() => setActiveModule('all')}>
              {t('changelog.allModules')}
            </FilterPill>
            {modules.map((m) => (
              <FilterPill key={m} active={activeModule === m} onClick={() => setActiveModule(m)}>
                {m}
              </FilterPill>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((entry) => (
              <ChangelogRow key={entry.id} entry={entry} dateFmt={dateFmt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChangelogRow({
  entry,
  dateFmt,
}: {
  entry: ChangelogEntry;
  dateFmt: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={TYPE_VARIANT[entry.change_type]} className="text-[11px]">
              {t(`changelog.type.${entry.change_type}`)}
            </Badge>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {entry.module}
            </span>
          </div>
          <p className="text-sm text-foreground">{entry.summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">
            {dateFmt.format(new Date(entry.committed_at))}
          </span>
          {entry.pr_number ? (
            <a
              href={prUrl(entry.pr_number)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
            >
              #{entry.pr_number}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
