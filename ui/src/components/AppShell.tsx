import { SidebarToggleProvider } from './SidebarToggleContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ImpersonationBanner from './ImpersonationBanner';

function AppShellInner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="h-screen bg-sidebar flex flex-col">
      <ImpersonationBanner />
      <TopBar />
      <div className="flex flex-1 overflow-hidden gap-2">
        <Sidebar />
        <main className="flex-1 overflow-y-auto rounded-tl-xl border-l border-t border-border bg-background p-4">
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
