import { buttonVariants } from '@/design-system/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';

import { useDashboardText } from '../hooks/useDashboardText';
import type { DashboardEmptyState as DashboardEmptyStateType, DashboardHeader } from '../types';

interface DashboardEmptyStateProps {
  header: DashboardHeader;
  emptyState: DashboardEmptyStateType;
}

export function DashboardEmptyState({ header, emptyState }: DashboardEmptyStateProps) {
  const resolveText = useDashboardText();

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
