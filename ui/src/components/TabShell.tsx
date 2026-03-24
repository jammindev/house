import * as React from 'react';
import { FilterPill } from '@/design-system/filter-pill';
import { useSessionState } from '@/lib/useSessionState';

export interface TabConfig<T extends string = string> {
  key: T;
  label: string;
  /** Optional count badge displayed inside the pill */
  badge?: number;
}

interface TabShellProps<T extends string> {
  tabs: TabConfig<T>[];
  /** sessionStorage key — persists the active tab across navigation */
  sessionKey: string;
  defaultTab: T;
  /** Render the content for the active tab */
  children: (activeTab: T) => React.ReactNode;
  /** Optional actions rendered to the right of the tab pills */
  actions?: (activeTab: T) => React.ReactNode;
}

export function TabShell<T extends string>({
  tabs,
  sessionKey,
  defaultTab,
  children,
  actions,
}: TabShellProps<T>) {
  const [activeTab, setActiveTab] = useSessionState<T>(sessionKey, defaultTab);

  // Guard: if the stored tab no longer exists (e.g. after a config change), reset to default
  const resolvedTab = tabs.some((t) => t.key === activeTab) ? activeTab : defaultTab;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((tab) => (
          <FilterPill
            key={tab.key}
            active={resolvedTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 ? (
              <span className="rounded-full bg-current px-1.5 text-[10px] leading-4 opacity-60">
                {tab.badge}
              </span>
            ) : null}
          </FilterPill>
        ))}
        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions(resolvedTab)}</div>
        ) : null}
      </div>

      {children(resolvedTab)}
    </div>
  );
}
