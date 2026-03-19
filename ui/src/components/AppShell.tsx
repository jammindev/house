import { SidebarToggleProvider } from './SidebarToggleContext';
import Sidebar from './Sidebar';
import ImpersonationBanner from './ImpersonationBanner';

export default function AppShell({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarToggleProvider>
      <div className="h-screen bg-background flex flex-col">
        <ImpersonationBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-2">{children}</main>
        </div>
      </div>
    </SidebarToggleProvider>
  );
}
