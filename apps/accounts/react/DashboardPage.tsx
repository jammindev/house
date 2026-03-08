import { ArrowRight, CalendarClock, FileText, FolderKanban, ListTodo, Plus, Settings2, Sparkles, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/design-system/badge';
import { buttonVariants } from '@/design-system/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { cn } from '@/lib/utils';

type DashboardTone = 'slate' | 'sky' | 'amber' | 'emerald' | 'rose';
type DashboardIconName = 'activity' | 'calendar' | 'documents' | 'plus' | 'projects' | 'settings' | 'tasks';

interface DashboardMetaItem {
  label: string;
  labelKey?: string;
  value: string;
}

interface DashboardBadge {
  label: string;
  tone: DashboardTone;
}

interface DashboardItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  badge?: DashboardBadge;
  meta: DashboardMetaItem[];
}

interface DashboardSection {
  id: string;
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  href: string;
  hrefLabel: string;
  hrefLabelKey?: string;
  icon: DashboardIconName;
  emptyMessage: string;
  emptyMessageKey?: string;
  items: DashboardItem[];
}

interface DashboardSummaryCard {
  id: string;
  label: string;
  labelKey?: string;
  value: number;
  helper: string;
  helperKey?: string;
  helperParams?: Record<string, string | number>;
  href: string;
  icon: DashboardIconName;
  tone: DashboardTone;
}

interface DashboardQuickAction {
  label: string;
  labelKey?: string;
  href: string;
  icon: DashboardIconName;
}

interface DashboardHeader {
  eyebrow: string;
  eyebrowKey?: string;
  title: string;
  titleKey?: string;
  subtitle: string;
  subtitleKey?: string;
}

interface DashboardEmptyState {
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  href: string;
  hrefLabel: string;
  hrefLabelKey?: string;
}

export interface DashboardPageProps {
  header: DashboardHeader;
  summary: DashboardSummaryCard[];
  quickActions: DashboardQuickAction[];
  sections: DashboardSection[];
  emptyState?: DashboardEmptyState | null;
}

const ICONS: Record<DashboardIconName, LucideIcon> = {
  activity: Sparkles,
  calendar: CalendarClock,
  documents: FileText,
  plus: Plus,
  projects: FolderKanban,
  settings: Settings2,
  tasks: ListTodo,
};

const TONE_STYLES: Record<DashboardTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

const SECTION_LAYOUT: Record<string, string> = {
  upcoming: 'lg:col-span-6',
  'pinned-projects': 'lg:col-span-6',
  tasks: 'xl:col-span-4',
  activity: 'xl:col-span-4',
  documents: 'xl:col-span-4',
};

function DashboardIcon({ name, className }: { name: DashboardIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}

function useDashboardText() {
  const { t } = useTranslation();

  return (key: string | undefined, fallback: string, params?: Record<string, string | number>) => {
    if (!key) {
      return fallback;
    }
    return t(key, { defaultValue: fallback, ...params });
  };
}

function ToneBadge({ badge }: { badge: DashboardBadge }) {
  return (
    <Badge variant="outline" className={cn('border px-2 py-0.5 text-[11px] font-medium', TONE_STYLES[badge.tone])}>
      {badge.label}
    </Badge>
  );
}

function SummaryCard({ card }: { card: DashboardSummaryCard }) {
  const resolveText = useDashboardText();

  return (
    <a href={card.href} className="block">
      <Card className="h-full overflow-hidden border-border/70 bg-card/95 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', TONE_STYLES[card.tone])}>
              <DashboardIcon name={card.icon} className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <CardDescription>{resolveText(card.labelKey, card.label)}</CardDescription>
          <CardTitle className="text-3xl font-semibold tracking-tight">{card.value}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{resolveText(card.helperKey, card.helper, card.helperParams)}</p>
        </CardContent>
      </Card>
    </a>
  );
}

function ItemCard({ item }: { item: DashboardItem }) {
  const resolveText = useDashboardText();

  const content = (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:border-border hover:bg-background">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
          {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
        </div>
        {item.badge ? <ToneBadge badge={item.badge} /> : null}
      </div>
      {item.meta.length ? (
        <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {item.meta.map((entry) => (
            <div key={`${item.id}-${entry.label}`} className="min-w-0">
              <dt className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">{resolveText(entry.labelKey, entry.label)}</dt>
              <dd className="truncate text-foreground/80">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );

  if (!item.url) {
    return content;
  }

  return (
    <a href={item.url} className="block">
      {content}
    </a>
  );
}

function SectionPanel({ section }: { section: DashboardSection }) {
  const resolveText = useDashboardText();

  return (
    <Card className={cn('border-border/70 bg-card/95', SECTION_LAYOUT[section.id] ?? 'xl:col-span-4')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/80 bg-muted/60 text-foreground/80">
                <DashboardIcon name={section.icon} className="h-4 w-4" />
              </div>
              <CardTitle className="text-lg">{resolveText(section.titleKey, section.title)}</CardTitle>
            </div>
            <CardDescription>{resolveText(section.descriptionKey, section.description)}</CardDescription>
          </div>
          <a href={section.href} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {resolveText(section.hrefLabelKey, section.hrefLabel)}
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.items.length ? (
          section.items.map((item) => <ItemCard key={item.id} item={item} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
            {resolveText(section.emptyMessageKey, section.emptyMessage)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage({ header, summary, quickActions, sections, emptyState }: DashboardPageProps) {
  const resolveText = useDashboardText();

  if (emptyState) {
    return (
      <Card className="overflow-hidden border-border/70 bg-card/95">
        <CardHeader className="space-y-2 bg-gradient-to-r from-slate-100 via-sky-50 to-emerald-50">
          <CardDescription>{resolveText(header.eyebrowKey, header.eyebrow)}</CardDescription>
          <CardTitle className="text-3xl">{resolveText(emptyState.titleKey, emptyState.title)}</CardTitle>
          <p className="max-w-2xl text-sm text-muted-foreground">{resolveText(emptyState.descriptionKey, emptyState.description)}</p>
        </CardHeader>
        <CardContent className="pt-6">
          <a href={emptyState.href} className={buttonVariants({ size: 'lg' })}>
            {resolveText(emptyState.hrefLabelKey, emptyState.hrefLabel)}
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.28),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(110,231,183,0.20),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700/80">{resolveText(header.eyebrowKey, header.eyebrow)}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{resolveText(header.titleKey, header.title)}</h1>
            <p className="text-sm text-muted-foreground sm:text-base">{resolveText(header.subtitleKey, header.subtitle)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, index) => (
              <a
                key={`${action.label}-${index}`}
                href={action.href}
                className={buttonVariants({ variant: index === 0 ? 'default' : 'outline', size: 'sm' })}
              >
                <DashboardIcon name={action.icon} className="mr-2 h-4 w-4" />
                {resolveText(action.labelKey, action.label)}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((card) => (
          <SummaryCard key={card.id} card={card} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-12 xl:grid-cols-12">
        {sections.map((section) => (
          <SectionPanel key={section.id} section={section} />
        ))}
      </section>
    </div>
  );
}