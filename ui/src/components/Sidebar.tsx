import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, User, ShieldCheck, X, AlertCircle, Sparkles, Activity,
  Rocket, Pin, PinOff, GraduationCap, type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { useSidebarToggle } from './SidebarToggleContext';
import HouseholdSwitcher from './HouseholdSwitcher';
import { useAlertsSummary } from '@/features/alerts/hooks';
import { useIsHouseholdOwner } from '@/features/ai-usage/hooks';
import {
  MODULES, MODULE_GROUPS, useDisabledModules, usePinnedModules, useSetPinnedModules,
  type ModuleDef,
} from '@/lib/modules';

const FIXED_TOP = [
  { to: '/app/dashboard', labelKey: 'dashboard.title', Icon: LayoutDashboard },
  { to: '/app/agent', labelKey: 'agent.title', Icon: Sparkles },
  { to: '/app/alerts', labelKey: 'alerts.title', Icon: AlertCircle, badge: 'alerts' as const },
];

interface NavItemProps {
  to: string;
  labelKey: string;
  Icon: LucideIcon;
  badgeCount?: number;
  badgeAriaLabel?: string;
  pin?: { pinned: boolean; onToggle: () => void };
  onNavigate: () => void;
}

function NavItem({ to, labelKey, Icon, badgeCount, badgeAriaLabel, pin, onNavigate }: NavItemProps) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group/item flex items-center gap-2.5 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
          <span className="flex-1 truncate">{t(labelKey)}</span>
          {pin ? (
            <button
              type="button"
              aria-label={pin.pinned ? t('sidebar.unpin') : t('sidebar.pin')}
              title={pin.pinned ? t('sidebar.unpin') : t('sidebar.pin')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                pin.onToggle();
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:text-foreground opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 max-lg:opacity-50 transition-opacity"
            >
              {pin.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          {badgeCount ? (
            <span
              className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground"
              aria-label={badgeAriaLabel}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = useIsHouseholdOwner();
  const { isSidebarOpen, closeSidebar } = useSidebarToggle();
  const { data: alertsSummary } = useAlertsSummary();
  const alertsCount = alertsSummary?.total ?? 0;

  const { disabled } = useDisabledModules();
  const pinned = usePinnedModules();
  const setPinned = useSetPinnedModules();

  const togglePin = (key: string) => {
    const next = pinned.includes(key) ? pinned.filter((k) => k !== key) : [...pinned, key];
    setPinned.mutate(next);
  };

  // Modules visibles = actifs pour le foyer ; un module épinglé sort de son
  // groupe et remonte dans la section « Épinglés » (pas de doublon).
  const visibleModules = MODULES.filter((m) => !disabled.has(m.key));
  const pinnedModules = pinned
    .map((key) => visibleModules.find((m) => m.key === key))
    .filter((m): m is ModuleDef => Boolean(m));
  const groupedModules = visibleModules.filter((m) => !pinned.includes(m.key));

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-60
        bg-sidebar
        z-50 flex flex-col
        transform transition-transform duration-300 ease-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:transform-none
      `}>

        {/* Mobile close + HouseholdSwitcher */}
        <div className="h-12 shrink-0 flex items-center justify-between gap-2 px-3">
          <div className="flex-1">
            <HouseholdSwitcher />
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <div>
            {FIXED_TOP.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                labelKey={item.labelKey}
                Icon={item.Icon}
                badgeCount={item.badge === 'alerts' && alertsCount > 0 ? alertsCount : undefined}
                badgeAriaLabel={t('alerts.badgeAriaLabel', { count: alertsCount })}
                onNavigate={closeSidebar}
              />
            ))}
          </div>

          {pinnedModules.length > 0 && (
            <div className="pt-3">
              <GroupLabel>{t('sidebar.pinned')}</GroupLabel>
              {pinnedModules.map((m) => (
                <NavItem
                  key={m.key}
                  to={m.to}
                  labelKey={m.labelKey}
                  Icon={m.Icon}
                  pin={{ pinned: true, onToggle: () => togglePin(m.key) }}
                  onNavigate={closeSidebar}
                />
              ))}
            </div>
          )}

          {MODULE_GROUPS.map((group) => {
            const items = groupedModules.filter((m) => m.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="pt-3">
                <GroupLabel>{t(group.labelKey)}</GroupLabel>
                {items.map((m) => (
                  <NavItem
                    key={m.key}
                    to={m.to}
                    labelKey={m.labelKey}
                    Icon={m.Icon}
                    pin={{ pinned: false, onToggle: () => togglePin(m.key) }}
                    onNavigate={closeSidebar}
                  />
                ))}
              </div>
            );
          })}

          <div className="pt-3">
            <GroupLabel>{t('sidebar.groupAccount')}</GroupLabel>
            <NavItem
              to="/app/tutorial"
              labelKey="tutorials.title"
              Icon={GraduationCap}
              onNavigate={closeSidebar}
            />
            <NavItem
              to="/app/settings"
              labelKey="settings.title"
              Icon={User}
              onNavigate={closeSidebar}
            />
          </div>

          {/* Admin */}
          {(user?.is_staff || isOwner) && (
            <div className="pt-3">
              <GroupLabel>{t('admin.section_label')}</GroupLabel>
              {user?.is_staff && (
                <NavItem
                  to="/app/admin/users"
                  labelKey="admin.users.title"
                  Icon={ShieldCheck}
                  onNavigate={closeSidebar}
                />
              )}
              {user?.is_staff && (
                <NavItem
                  to="/app/admin/changelog"
                  labelKey="changelog.title"
                  Icon={Rocket}
                  onNavigate={closeSidebar}
                />
              )}
              {isOwner && (
                <NavItem
                  to="/app/admin/ai-usage"
                  labelKey="aiUsage.title"
                  Icon={Activity}
                  onNavigate={closeSidebar}
                />
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
