import { useDashboardText } from '../hooks/useDashboardText';
import type { DashboardHeader, DashboardQuickAction } from '../types';
import { QuickActionButton } from './QuickActionButton';

interface DashboardHeroProps {
  header: DashboardHeader;
  quickActions: DashboardQuickAction[];
}

export function DashboardHero({ header, quickActions }: DashboardHeroProps) {
  const resolveText = useDashboardText();

  return (
    <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.28),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(110,231,183,0.20),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))] p-6 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(52,211,153,0.09),_transparent_24%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.96))] sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700/80 dark:text-sky-300/70">{resolveText(header.eyebrowKey, header.eyebrow)}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{resolveText(header.titleKey, header.title)}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">{resolveText(header.subtitleKey, header.subtitle)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <QuickActionButton key={`${action.label}-${index}`} action={action} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
