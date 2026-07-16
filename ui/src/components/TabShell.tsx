import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { FilterPill } from '@/design-system/filter-pill';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';
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
  /** Notified whenever the active tab resolves/changes (e.g. to keep it visible). */
  onTabChange?: (activeTab: T) => void;
  /**
   * Tabs hidden from the bar (e.g. empty) but reachable via a « + » menu, so the
   * user can still open one to add its first item. Selecting one activates it.
   */
  moreTabs?: TabConfig<T>[];
}

export function TabShell<T extends string>({
  tabs,
  sessionKey,
  defaultTab,
  children,
  actions,
  onTabChange,
  moreTabs = [],
}: TabShellProps<T>) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useSessionState<T>(sessionKey, defaultTab);

  // Guard: if the stored tab no longer exists (e.g. after a config change), reset
  // to default. `moreTabs` are known too — an active tab picked from the « + »
  // menu is valid even before the parent moves it into `tabs`.
  const known = React.useMemo(() => [...tabs, ...moreTabs], [tabs, moreTabs]);
  const resolvedTab = known.some((t) => t.key === activeTab) ? activeTab : defaultTab;

  // Keep the parent informed of the effective tab (used to pin it visible).
  React.useEffect(() => {
    onTabChange?.(resolvedTab);
  }, [resolvedTab, onTabChange]);

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
              <span className="rounded-full bg-current/15 px-1.5 text-[10px] font-semibold leading-4">
                {tab.badge}
              </span>
            ) : null}
          </FilterPill>
        ))}
        {moreTabs.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t('common.showMore')}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {moreTabs.map((tab) => (
                <DropdownMenuItem key={tab.key} onClick={() => setActiveTab(tab.key)}>
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions(resolvedTab)}</div>
        ) : null}
      </div>

      {children(resolvedTab)}
    </div>
  );
}
