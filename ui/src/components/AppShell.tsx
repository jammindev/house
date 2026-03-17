import { SidebarToggleProvider } from './SidebarToggleContext';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarToggleProvider>
      <div className="h-screen bg-background flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-2">{children}</main>
      </div>
    </SidebarToggleProvider>
  );
}
