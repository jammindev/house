import { DashboardEmptyState } from './dashboard-page/components/DashboardEmptyState';
import { DashboardHero } from './dashboard-page/components/DashboardHero';
import { SectionPanel } from './dashboard-page/components/SectionPanel';
import { SummaryCard } from './dashboard-page/components/SummaryCard';
import type { DashboardPageProps } from './dashboard-page/types';

export type { DashboardPageProps } from './dashboard-page/types';

export default function DashboardPage({ header, summary, quickActions, sections, emptyState }: DashboardPageProps) {
  if (emptyState) {
    return <DashboardEmptyState header={header} emptyState={emptyState} />;
  }

  return (
    <div className="space-y-6">
      <DashboardHero header={header} quickActions={quickActions} />

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