// Admin layout with navigation and protection
// Admin layout with navigation and protection
"use client";

import { AdminGuard } from '@/features/admin/components/AdminGuard';
import { AdminNav } from '@/features/admin/components/AdminNav';
import { GlobalProvider } from '@/lib/context/GlobalContext';
import { ToastProvider } from '@/components/ToastProvider';
import ScrollToTop from '@/components/ScrollToTop';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <GlobalProvider>
            <ToastProvider>
                <ScrollToTop />
                <AdminGuard>
                    <div className="min-h-screen bg-background">
                        <div className="flex h-screen">
                            {/* Sidebar */}
                            <div className="w-64 border-r bg-muted/10">
                                <div className="p-4">
                                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white text-sm font-bold">
                                            A
                                        </div>
                                        Administration
                                    </h2>
                                    <AdminNav />
                                </div>
                            </div>

                            {/* Main content */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <main className="flex-1 overflow-auto">
                                    {children}
                                </main>
                            </div>
                        </div>
                    </div>
                </AdminGuard>
            </ToastProvider>
        </GlobalProvider>
    );
}
