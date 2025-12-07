// nextjs/src/components/layout/AppLayout.tsx
"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { createSPASassClient } from "@/lib/supabase/client";
import { SidebarToggleProvider } from "./SidebarToggleContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [, startTransition] = useTransition();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
            startTransition(() => {
                router.push("/auth/login");
            });
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const handleChangePassword = () => {
        startTransition(() => {
            router.push("/app/user-settings");
        });
    };

    const toggleSidebar = () => setSidebarOpen((prev) => !prev);

    return (
        <SidebarToggleProvider value={{ isSidebarOpen, toggleSidebar }}>
            <div className="min-h-screen p-2 md:p-0 bg-gray-100 flex flex-col relative">
                {/* Overlay (mobile) */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-gray-600 bg-opacity-75 z-30 lg:hidden"
                        onClick={toggleSidebar}
                    />
                )}

                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={toggleSidebar}
                    onLogout={handleLogout}
                    onChangePassword={handleChangePassword}
                />

                <main className="flex-1 p-2 md:p-4 lg:pl-64">{children}</main>
            </div>
        </SidebarToggleProvider>
    );
}
