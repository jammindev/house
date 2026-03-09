import { ArrowRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';
import { cn } from '@/lib/utils';

import { TONE_STYLES } from '../constants';
import { useDashboardText } from '../hooks/useDashboardText';
import type { DashboardSummaryCard } from '../types';
import { DashboardIcon } from './DashboardIcon';

interface SummaryCardProps {
  card: DashboardSummaryCard;
}

export function SummaryCard({ card }: SummaryCardProps) {
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
