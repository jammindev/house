// src/app/app/layout.tsx
import AppLayout from '@/components/AppLayout';
import { GlobalProvider } from '@/lib/context/GlobalContext';
import { ToastProvider } from '@/components/ToastProvider';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <GlobalProvider>
            <ToastProvider>
                <AppLayout>{children}</AppLayout>
            </ToastProvider>
        </GlobalProvider>
    );
}
