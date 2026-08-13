import { LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import { useSidebarToggle } from './SidebarToggleContext';
import HouseholdSwitcher from './HouseholdSwitcher';
import NotificationsBell from '@/features/notifications/NotificationsBell';
import GlobalSearch from '@/features/search/GlobalSearch';
import WeatherChip from '@/features/weather/WeatherChip';
import { Logo } from '@/design-system/logo';

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
    <header className="h-12 shrink-0 bg-sidebar flex items-center gap-2 px-3 sm:gap-3 sm:px-4 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={t('sidebar.open')}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo — masqué sur mobile, où le hamburger ancre déjà la gauche et où
          chaque pixel va au nom du foyer.

          Plus de pastille `bg-primary` : la marque n'est pas la couleur du
          thème. Les 17 thèmes de `themes.css` repeignaient `--primary`, donc la
          marque changeait de couleur d'un foyer à l'autre. Le signe hérite
          désormais de la couleur du texte (`currentColor`), et la couleur de
          marque ne vit que là où le thème ne va pas — favicon, icônes PWA,
          aperçu social. Voir `design-system/logo.tsx`. */}
      <Link
        to="/app/dashboard"
        className="hidden sm:flex shrink-0 items-center text-foreground transition-colors hover:text-primary"
        aria-label={t('dashboard.title')}
      >
        <Logo size={26} />
      </Link>

      {/* Le foyer, pas le nom de l'app */}
      <div className="min-w-0 flex-1">
        <HouseholdSwitcher />
      </div>

      {/* Météo du foyer */}
      <WeatherChip />

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
