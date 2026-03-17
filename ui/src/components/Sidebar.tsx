import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, FolderKanban, Wrench, Box,
  Zap, MapPin, Users, FileText, Image, Notebook, User,
  LogOut, X,
} from 'lucide-react';
import { useAuth } from '../lib/auth/context';
import { useSidebarToggle } from './SidebarToggleContext';
import HouseholdSwitcher from './HouseholdSwitcher';

const NAV_ITEMS = [
  { to: '/app/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/app/tasks',        label: 'Tasks',        Icon: ListTodo        },
  { to: '/app/projects',     label: 'Projects',     Icon: FolderKanban    },
  { to: '/app/equipment',    label: 'Equipment',    Icon: Wrench          },
  { to: '/app/stock',        label: 'Stock',        Icon: Box             },
  { to: '/app/electricity',  label: 'Electricity',  Icon: Zap             },
  { to: '/app/zones',        label: 'Zones',        Icon: MapPin          },
  { to: '/app/directory',    label: 'Directory',    Icon: Users           },
  { to: '/app/documents',    label: 'Documents',    Icon: FileText        },
  { to: '/app/photos',       label: 'Photos',       Icon: Image           },
  { to: '/app/interactions', label: 'Interactions', Icon: Notebook        },
  { to: '/app/settings',     label: 'Settings',     Icon: User            },
] as const;

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isSidebarOpen, closeSidebar } = useSidebarToggle();

  const initial = (user?.first_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email;

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-72
        bg-gradient-to-b from-card/95 to-background/90 backdrop-blur-2xl
        border-r border-border shadow-2xl
        z-50 flex flex-col
        transform transition-transform duration-300 ease-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:transform-none
      `}>

        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border bg-card/60 shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            House
          </span>
          <div className="hidden lg:block">
            <HouseholdSwitcher />
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-accent/80 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 border-b border-border lg:hidden">
          <HouseholdSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 mt-3 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `group flex items-center w-full px-4 py-3 text-sm font-semibold rounded-2xl border transition-all active:scale-[0.98] ${
                  isActive
                    ? 'bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-sm border-primary/40'
                    : 'border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:shadow-sm'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`mr-3 h-5 w-5 shrink-0 transition-transform ${
                    isActive
                      ? 'text-primary scale-110'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-gradient-to-t from-card/60 to-transparent shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/60 border border-border shadow-sm mb-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl active:scale-[0.98] transition-all"
          >
            <LogOut className="mr-3 h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>

      </aside>
    </>
  );
}
