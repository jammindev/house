import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import BudgetsPanel from './BudgetsPanel';

/**
 * La page « Budgets » du groupe Argent (issue #562) — `/app/money/budgets`.
 *
 * Le panneau est inchangé : la page ne fait que lui rendre le `PageHeader` que
 * la coque à onglets portait à sa place.
 */
export default function BudgetsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('budget.title')} description={t('budget.description')} />
      <BudgetsPanel />
    </>
  );
}
