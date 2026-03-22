import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SidebarToggleProvider, useSidebarToggle } from './SidebarToggleContext';
import Sidebar from './Sidebar';
import ImpersonationBanner from './ImpersonationBanner';

function AppShellInner({ children }: { children?: React.ReactNode }) {
  const { toggleSidebar } = useSidebarToggle();
  const { t } = useTranslation();
  return (
    <div className="h-screen bg-background flex flex-col">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-2">
          <button
            onClick={toggleSidebar}
            className="lg:hidden mb-2 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/80 active:scale-95 transition-all"
            aria-label={t('sidebar.open')}
          >
            <Menu className="h-5 w-5" />
          </button>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarToggleProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarToggleProvider>
  );
}
