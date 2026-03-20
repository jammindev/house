import { createContext, useContext, useState } from 'react';

interface SidebarToggleContextValue {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarToggleContext = createContext<SidebarToggleContextValue | null>(null);

export function SidebarToggleProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setOpen] = useState(false);
  return (
    <SidebarToggleContext.Provider value={{
      isSidebarOpen,
      toggleSidebar: () => setOpen((v) => !v),
      closeSidebar: () => setOpen(false),
    }}>
      {children}
    </SidebarToggleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarToggle() {
  const ctx = useContext(SidebarToggleContext);
  if (!ctx) throw new Error('useSidebarToggle must be inside SidebarToggleProvider');
  return ctx;
}
