import HeroGreeting from './HeroGreeting';
import QuickActions from './QuickActions';
import TriageSection from './TriageSection';
import MyWeekCard from './MyWeekCard';
import ExpensesCard from './ExpensesCard';
import ElectricityCard from './ElectricityCard';
import WaterCard from './WaterCard';
import ChickensCard from './ChickensCard';
import ActivityTimeline from './ActivityTimeline';
import PinnedProjects from './PinnedProjects';
import { useDisabledModules } from '@/lib/modules';

/**
 * Household control room, top to bottom: what needs action (triage + my week),
 * the household's pulse (money, energy, water — each card hides
 * itself when its module holds no data), then context (activity, projects).
 * Cards of household-disabled modules are not mounted at all, so their
 * queries never fire.
 */
export default function DashboardPage() {
  const { disabled } = useDisabledModules();
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
        {!disabled.has('electricity') && <ElectricityCard />}
        {!disabled.has('water') && <WaterCard />}
        {!disabled.has('chickens') && <ChickensCard />}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ActivityTimeline />
        <PinnedProjects />
      </section>
    </div>
  );
}
