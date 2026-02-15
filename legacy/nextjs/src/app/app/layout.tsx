// src/app/app/layout.tsx
'use client';

import AppLayout from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ToastProvider';
import { GlobalProvider } from '@/lib/context/GlobalContext';
import ScrollToTop from '@/components/ScrollToTop';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalProvider>
      <ToastProvider>
        <ScrollToTop />
        <AppLayout>{children}</AppLayout>
      </ToastProvider>
    </GlobalProvider>
  );
}