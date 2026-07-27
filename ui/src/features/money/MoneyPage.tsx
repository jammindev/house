import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { TabShell, type TabConfig } from '@/components/TabShell';
import { useSessionState } from '@/lib/useSessionState';
import { useComplianceSummary } from './hooks';
import { PENDING_KINDS } from './keys';
import CompliancePanel from './CompliancePanel';
import PendingQueue from './PendingQueue';
import AccountsPanel from './AccountsPanel';
import ExpensesPanel from './ExpensesPanel';
import BudgetsPanel from './BudgetsPanel';

const MONEY_TAB_SESSION_KEY = 'money.tab';

const TAB_KEYS = ['control', 'pending', 'accounts', 'expenses', 'budgets'] as const;
type MoneyTab = (typeof TAB_KEYS)[number];

function isMoneyTab(value: string | null): value is MoneyTab {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value);
}

/**
 * Le module « Argent » (parcours 26, lot 2).
 *
 * Comptes, dépenses et budgets étaient trois pages. Ils deviennent trois onglets,
 * parce que ce sont trois lectures d'un même fait : ce qui est sorti du compte. Et
 * deux onglets nouveaux passent devant — **Contrôle** et **À ranger** — parce que
 * la question « qu'est-ce qu'il me reste à faire pour que ma vision soit juste ? »
 * doit se poser avant « combien ai-je dépensé ? ».
 */
export default function MoneyPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const summaryQuery = useComplianceSummary();

  // L'onglet actif vit ici, et `TabShell` en est le miroir contrôlé.
  //
  // Il vivait dans `TabShell`, ce qui laissait le parent sans prise : pour
  // renvoyer l'utilisateur de « À ranger » vers « Contrôle », la seule voie était
  // d'écrire dans `sessionStorage` puis de faire un `window.location.assign` —
  // un rechargement complet du navigateur au milieu d'une SPA, qui vidait tout le
  // cache React Query et refetchait chaque compteur pour un changement d'onglet.
  // Le deep link `?tab=budgets` (anciennes URLs, liens de l'agent) devient au
  // passage une simple valeur initiale, au lieu d'un tour de passe-passe sur
  // l'ordre de montage des composants.
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useSessionState<MoneyTab>(
    MONEY_TAB_SESSION_KEY,
    isMoneyTab(requestedTab) ? requestedTab : 'control',
  );

  React.useEffect(() => {
    if (isMoneyTab(requestedTab)) setTab(requestedTab);
  }, [requestedTab, setTab]);

  const summary = summaryQuery.data;

  const pendingCount = React.useMemo(() => {
    if (!summary) return 0;
    return summary.groups
      .filter((group) => (PENDING_KINDS as readonly string[]).includes(group.kind))
      .reduce((total, group) => total + group.open, 0);
  }, [summary]);

  const tabs: TabConfig<MoneyTab>[] = [
    { key: 'control', label: t('money.tabs.control'), badge: summary?.open_total ?? 0 },
    { key: 'pending', label: t('money.tabs.pending'), badge: pendingCount },
    { key: 'accounts', label: t('money.tabs.accounts') },
    { key: 'expenses', label: t('money.tabs.expenses') },
    { key: 'budgets', label: t('money.tabs.budgets') },
  ];

  return (
    <>
      <PageHeader title={t('money.title')} description={t('money.description')} />

      <TabShell
        tabs={tabs}
        sessionKey={MONEY_TAB_SESSION_KEY}
        defaultTab="control"
        value={tab}
        onValueChange={setTab}
      >
        {(activeTab) => {
          if (activeTab === 'control') return <CompliancePanel />;
          if (activeTab === 'pending') {
            // La file renvoie vers Contrôle quand un prérequis la rend vide : sinon
            // l'utilisateur voit une file vide sans savoir où agir.
            return <PendingQueue onGoToControl={() => setTab('control')} />;
          }
          if (activeTab === 'accounts') return <AccountsPanel />;
          if (activeTab === 'expenses') return <ExpensesPanel />;
          return <BudgetsPanel />;
        }}
      </TabShell>
    </>
  );
}
