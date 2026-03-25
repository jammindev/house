import { SidebarToggleProvider } from './SidebarToggleContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ImpersonationBanner from './ImpersonationBanner';

function AppShellInner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="h-dvh bg-sidebar flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <ImpersonationBanner />
      <TopBar />
      <div className="flex flex-1 overflow-hidden gap-2">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden lg:rounded-tl-xl lg:border-l lg:border-t border-border bg-background p-4">
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
