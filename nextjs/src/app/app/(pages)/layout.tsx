// nextjs/src/app/app/(pages)/layout.tsx
'use client';

import React, { useState, createContext, useContext, ReactNode } from 'react';
import AppPageLayout from '@/components/layout/AppPageLayout';
import type { LucideIcon } from 'lucide-react';

// --- Types partagés ---
interface PageAction {
  icon: LucideIcon;
  label?: string;
  href?: string;
  onClick?: () => void;
}

interface PageLayoutContextType {
  title: string;
  subtitle?: string;
  context?: string;
  hideBackButton?: boolean;
  actions?: PageAction[];
  setTitle: (title: string) => void;
  setSubtitle: (subtitle?: string) => void;
  setContext: (context?: string) => void;
  setActions: (actions?: PageAction[]) => void;
  setHideBackButton: (hide: boolean) => void;
}

// --- Création du context ---
const PageLayoutContext = createContext<PageLayoutContextType | undefined>(undefined);

// --- Hook d’accès ---
export const usePageLayout = () => {
  const context = useContext(PageLayoutContext);
  if (!context) {
    throw new Error('usePageLayout must be used within a PagesLayout');
  }
  return context;
};

// --- Layout principal ---
export default function PagesLayout({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [contextText, setContext] = useState<string | undefined>();
  const [actions, setActions] = useState<PageAction[] | undefined>();
  const [hideBackButton, setHideBackButton] = useState(false);

  return (
    <PageLayoutContext.Provider
      value={{
        title,
        subtitle,
        context: contextText,
        actions,
        hideBackButton,
        setTitle,
        setSubtitle,
        setContext,
        setActions,
        setHideBackButton,
      }}
    >
      <AppPageLayout
        title={title}
        subtitle={subtitle}
        context={contextText}
        actions={actions}
        hideBackButton={hideBackButton}
      >
        {children}
      </AppPageLayout>
    </PageLayoutContext.Provider>
  );
}
