import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import ExpensesPanel from './ExpensesPanel';

/**
 * La page « Dépenses » du groupe Argent (issue #562) — `/app/money/expenses`.
 *
 * Le panneau est inchangé : la page ne fait que lui rendre le `PageHeader` que
 * la coque à onglets portait à sa place.
 */
export default function ExpensesPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('expenses.title')} description={t('expenses.description')} />
      <ExpensesPanel />
    </>
  );
}
