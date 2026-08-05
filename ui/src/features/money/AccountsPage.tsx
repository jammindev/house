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

const ACCOUNTS_TAB_SESSION_KEY = 'money.accountsTab';

const TAB_KEYS = ['accounts', 'control', 'pending'] as const;
export type AccountsTab = (typeof TAB_KEYS)[number];

function isAccountsTab(value: string | null): value is AccountsTab {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value);
}

/**
 * La page « Comptes » du groupe Argent (issue #562).
 *
 * Budgets et Dépenses sont partis dans leurs propres pages ; ce qui reste ici
 * tient ensemble pour une raison : **Contrôle** et **À ranger** ne portent que
 * sur ce que les relevés laissent en suspens. Ce sont deux façons de regarder ce
 * qui manque à un compte, pas deux destinations — les séparer de la page des
 * comptes obligerait à changer d'écran pour agir sur ce qu'on vient d'y lire.
 *
 * L'onglet par défaut est « Comptes » : une entrée de sidebar qui annonce les
 * comptes et ouvre autre chose fait douter du clic.
 */
export default function AccountsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const summaryQuery = useComplianceSummary();

  // L'onglet actif vit ici, et `TabShell` en est le miroir contrôlé : la file
  // « À ranger » renvoie vers « Contrôle » quand un prérequis la vide, et sans
  // cette prise la seule voie était un `window.location.assign` — un
  // rechargement complet du navigateur au milieu d'une SPA.
  //
  // `?tab=` reste lu ici parce que `/app/money?tab=control` continue d'arriver
  // (favoris, anciens liens) : la redirection le transporte jusqu'à cette page.
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useSessionState<AccountsTab>(
    ACCOUNTS_TAB_SESSION_KEY,
    isAccountsTab(requestedTab) ? requestedTab : 'accounts',
  );

  React.useEffect(() => {
    if (isAccountsTab(requestedTab)) setTab(requestedTab);
  }, [requestedTab, setTab]);

  const summary = summaryQuery.data;

  const pendingCount = React.useMemo(() => {
    if (!summary) return 0;
    return summary.groups
      .filter((group) => (PENDING_KINDS as readonly string[]).includes(group.kind))
      .reduce((total, group) => total + group.open, 0);
  }, [summary]);

  const tabs: TabConfig<AccountsTab>[] = [
    { key: 'accounts', label: t('banking.title') },
    { key: 'control', label: t('money.tabs.control'), badge: summary?.open_total ?? 0 },
    { key: 'pending', label: t('money.tabs.pending'), badge: pendingCount },
  ];

  return (
    <>
      <PageHeader title={t('banking.title')} description={t('banking.subtitle')} />

      <TabShell
        tabs={tabs}
        sessionKey={ACCOUNTS_TAB_SESSION_KEY}
        defaultTab="accounts"
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
          return <AccountsPanel />;
        }}
      </TabShell>
    </>
  );
}
