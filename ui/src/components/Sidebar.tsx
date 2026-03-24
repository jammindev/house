import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, FolderKanban, Wrench, Box,
  Zap, MapPin, Users, FileText, Image, Notebook, User,
  ShieldCheck, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { useSidebarToggle } from './SidebarToggleContext';
import HouseholdSwitcher from './HouseholdSwitcher';

const NAV_GROUPS = [
  {
    items: [
      { to: '/app/dashboard', labelKey: 'dashboard.title', Icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'sidebar.groupHome',
    items: [
      { to: '/app/zones',       labelKey: 'zones.title',       Icon: MapPin },
      { to: '/app/equipment',   labelKey: 'equipment.title',   Icon: Wrench },
      { to: '/app/electricity', labelKey: 'electricity.title', Icon: Zap    },
      { to: '/app/stock',       labelKey: 'stock.title',       Icon: Box    },
    ],
  },
  {
    labelKey: 'sidebar.groupTracking',
    items: [
      { to: '/app/tasks',        labelKey: 'tasks.title',        Icon: ListTodo     },
      { to: '/app/projects',     labelKey: 'projects.title',     Icon: FolderKanban },
      { to: '/app/interactions', labelKey: 'interactions.title', Icon: Notebook     },
    ],
  },
  {
    labelKey: 'sidebar.groupResources',
    items: [
      { to: '/app/documents', labelKey: 'documents.title', Icon: FileText },
      { to: '/app/photos',    labelKey: 'photos.title',    Icon: Image    },
      { to: '/app/directory', labelKey: 'directory.title', Icon: Users    },
    ],
  },
  {
    labelKey: 'sidebar.groupAccount',
    items: [
      { to: '/app/settings', labelKey: 'settings.title', Icon: User },
    ],
  },
] as const;

export default function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSidebarOpen, closeSidebar } = useSidebarToggle();

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

        {/* Mobile HouseholdSwitcher shown above is enough */}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
              {'labelKey' in group && group.labelKey && (
                <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                  {t(group.labelKey)}
                </p>
              )}
              {group.items.map(({ to, labelKey, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                      {t(labelKey)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Admin */}
          {user?.is_staff && (
            <div className="pt-3">
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                {t('admin.section_label')}
              </p>
              <NavLink
                to="/app/admin/users"
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <ShieldCheck className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                    {t('admin.users.title')}
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
