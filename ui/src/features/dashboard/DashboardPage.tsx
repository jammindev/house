import HeroGreeting from './HeroGreeting';
import QuickActions from './QuickActions';
import TriageSection from './TriageSection';
import MyWeekCard from './MyWeekCard';
import ExpensesCard from './ExpensesCard';
import ElectricityCard from './ElectricityCard';
import WaterCard from './WaterCard';
import RunwaysCard from './RunwaysCard';
import ActivityTimeline from './ActivityTimeline';
import PinnedProjects from './PinnedProjects';

/**
 * Household control room, top to bottom: what needs action (triage + my week),
 * the household's pulse (money, energy, water, runways — each card hides
 * itself when its module holds no data), then context (activity, projects).
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <HeroGreeting />
      <QuickActions />

      <section className="grid gap-4 lg:grid-cols-2">
        <TriageSection />
        <MyWeekCard />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExpensesCard />
        <ElectricityCard />
        <WaterCard />
        <RunwaysCard />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ActivityTimeline />
        <PinnedProjects />
      </section>
    </div>
  );
}
