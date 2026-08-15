import HeroGreeting from './HeroGreeting';
import RecapTeaserCard from './RecapTeaserCard';
import QuickActions from './QuickActions';
import TriageSection from './TriageSection';
import MyWeekCard from './MyWeekCard';
import ExpensesCard from './ExpensesCard';
import ElectricityCard from './ElectricityCard';
import WaterCard from './WaterCard';
import WeatherCard from './WeatherCard';
import ChickensCard from './ChickensCard';
import ActivityTimeline from './ActivityTimeline';
import PinnedProjects from './PinnedProjects';
import FirstStepsCard from './FirstStepsCard';
import { useDisabledModules } from '@/lib/modules';
import { useAlertsSummary } from '@/features/alerts/hooks';

/**
 * Household control room, top to bottom: what needs action (triage + my week),
 * the household's pulse (money, energy, water — each card hides
 * itself when its module holds no data), then context (activity, projects).
 * Cards of household-disabled modules are not mounted at all, so their
 * queries never fire.
 *
 * ⚠️ **Un foyer vide n'est pas un foyer calme.** Tant que rien n'a été saisi,
 * toutes les cartes ci-dessous sont vides et le tableau de bord n'apprend rien —
 * il affirme même le contraire de la vérité (« tout est sous contrôle »). On
 * montre alors les premiers pas à leur place, et ils s'effacent d'eux-mêmes dès
 * que le foyer vit. Le signal vient du serveur, mesuré et non déclaré.
 */
export default function DashboardPage() {
  const { disabled } = useDisabledModules();
  const { data: alerts } = useAlertsSummary();
  const isEmpty = alerts?.household_is_empty;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <HeroGreeting />
        <QuickActions />
        <FirstStepsCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeroGreeting />
      {/* Le récap frais passe devant tout : c'est le seul bloc du dashboard qui
          ne demande rien et rend quelque chose. Il ne rend rien s'il n'y a pas de
          récap à annoncer. */}
      <RecapTeaserCard />
      <QuickActions />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TriageSection />
        <MyWeekCard />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExpensesCard />
        {!disabled.has('weather') && <WeatherCard />}
        {!disabled.has('electricity') && <ElectricityCard />}
        {!disabled.has('water') && <WaterCard />}
        {!disabled.has('chickens') && <ChickensCard />}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityTimeline />
        <PinnedProjects />
      </section>
    </div>
  );
}
