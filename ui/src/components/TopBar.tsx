import { Home, LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { useSidebarToggle } from './SidebarToggleContext';
import HouseholdSwitcher from './HouseholdSwitcher';
import NotificationsBell from '@/features/notifications/NotificationsBell';
import GlobalSearch from '@/features/search/GlobalSearch';

export default function TopBar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebarToggle();

  // `full_name` vient du serveur (`User.full_name`) et couvre déjà les trois cas.
  // Recomposer la règle ici avait fait retomber tout le monde sur l'email :
  // `first_name`/`last_name` ne sont éditables nulle part dans l'app (#546).
  const displayName = user?.full_name || user?.email;
  const initial = (displayName?.[0] ?? '?').toUpperCase();

  return (
    <header className="h-12 shrink-0 bg-sidebar flex items-center gap-3 px-4 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={t('sidebar.open')}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
          <Home className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm text-foreground hidden sm:block">House</span>
      </div>

      {/* Household switcher */}
      <div className="hidden md:block">
        <HouseholdSwitcher />
      </div>

      <div className="flex-1" />

      {/* App-wide search — box on desktop, magnifier on mobile */}
      <GlobalSearch />

      {/* Notifications */}
      <NotificationsBell />

      {/* User */}
      <div className="flex items-center gap-2">
        {/* Le header ne dit que le nom. L'email est une donnée de compte : il se
            lit dans les réglages, pas en permanence au-dessus de chaque écran. */}
        <div className="hidden sm:flex flex-col items-end">
          <span data-testid="topbar-display-name" className="text-sm font-medium text-foreground truncate max-w-32">{displayName}</span>
        </div>
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={displayName ?? ''}
            className="h-8 w-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div data-testid="topbar-initial" className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
            {initial}
          </div>
        )}
        <button
          onClick={logout}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t('auth.logout')}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
