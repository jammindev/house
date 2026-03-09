import { Badge } from '@/design-system/badge';
import { buttonVariants } from '@/design-system/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { cn } from '@/lib/utils';

import { SECTION_LAYOUT, TONE_STYLES } from '../constants';
import { useDashboardText } from '../hooks/useDashboardText';
import type { DashboardBadge, DashboardItem, DashboardSection } from '../types';
import { DashboardIcon } from './DashboardIcon';

interface ToneBadgeProps {
  badge: DashboardBadge;
}

function ToneBadge({ badge }: ToneBadgeProps) {
  return (
    <Badge variant="outline" className={cn('border px-2 py-0.5 text-[11px] font-medium', TONE_STYLES[badge.tone])}>
      {badge.label}
    </Badge>
  );
}

interface ItemCardProps {
  item: DashboardItem;
}

function ItemCard({ item }: ItemCardProps) {
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

interface SectionPanelProps {
  section: DashboardSection;
}

export function SectionPanel({ section }: SectionPanelProps) {
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
