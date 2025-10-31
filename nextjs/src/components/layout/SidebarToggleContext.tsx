"use client";

import { createContext, useContext, type ReactNode } from "react";

type SidebarContextValue = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
};

const SidebarToggleContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarToggleProvider({
  value,
  children,
}: {
  value: SidebarContextValue;
  children: ReactNode;
}) {
  return (
    <SidebarToggleContext.Provider value={value}>
      {children}
    </SidebarToggleContext.Provider>
  );
}

export function useSidebarToggle() {
  const context = useContext(SidebarToggleContext);
  if (!context) {
    throw new Error("useSidebarToggle must be used within a SidebarToggleProvider");
  }
  return context;
}
