import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { TabShell, type TabConfig } from '@/components/TabShell';
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

  // Deep link `?tab=budgets` — les anciennes URLs (/app/budget…) et les liens de
  // l'agent y atterrissent. Écrit dans la session **avant** que TabShell lise sa
  // valeur initiale : l'initialiseur d'état du parent s'exécute avant le montage
  // de l'enfant, ce qui rend le tour de passe-passe fiable plutôt que fragile.
  const requestedTab = searchParams.get('tab');
  React.useState(() => {
    if (isMoneyTab(requestedTab)) {
      try {
        sessionStorage.setItem(MONEY_TAB_SESSION_KEY, JSON.stringify(requestedTab));
      } catch {
        // sessionStorage indisponible (navigation privée) — l'onglet par défaut
        // s'affiche, ce qui est dégradé mais pas cassé.
      }
    }
    return null;
  });

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
        defaultTab={isMoneyTab(requestedTab) ? requestedTab : 'control'}
      >
        {(tab) => {
          if (tab === 'control') return <CompliancePanel />;
          if (tab === 'pending') return <PendingQueue />;
          if (tab === 'accounts') return <AccountsPanel />;
          if (tab === 'expenses') return <ExpensesPanel />;
          return <BudgetsPanel />;
        }}
      </TabShell>
    </>
  );
}
