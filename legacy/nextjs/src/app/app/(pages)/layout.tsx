// nextjs/src/app/app/(pages)/layout.tsx
'use client';

import React, { useState, createContext, useContext, ReactNode } from 'react';
import AppPageLayout, { type PageAction } from '@/components/layout/AppPageLayout';

interface PageLayoutContextType {
  title: string;
  subtitle?: string;
  context?: string;
  hideBackButton: boolean;
  actions?: PageAction[];
  className?: string;
  contentClassName?: string;
  loading: boolean;
  setTitle: (title: string) => void;
  setSubtitle: (subtitle?: string) => void;
  setContext: (context?: string) => void;
  setActions: (actions?: PageAction[]) => void;
  setHideBackButton: (hide: boolean) => void;
  setClassName: (value?: string) => void;
  setContentClassName: (value?: string) => void;
  setLoading: (value: boolean) => void;
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
  const [className, setClassName] = useState<string | undefined>();
  const [contentClassName, setContentClassName] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  return (
    <PageLayoutContext.Provider
      value={{
        title,
        subtitle,
        context: contextText,
        actions,
        hideBackButton,
        className,
        contentClassName,
        loading,
        setTitle,
        setSubtitle,
        setContext,
        setActions,
        setHideBackButton,
        setClassName,
        setContentClassName,
        setLoading,
      }}
    >
      <AppPageLayout
        title={title}
        subtitle={subtitle}
        context={contextText}
        actions={actions}
        hideBackButton={hideBackButton}
        className={className}
        contentClassName={contentClassName}
        loading={loading}
      >
        {children}
      </AppPageLayout>
    </PageLayoutContext.Provider>
  );
}
