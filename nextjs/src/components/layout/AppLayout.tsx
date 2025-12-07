// nextjs/src/components/layout/AppLayout.tsx
"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { createSPASassClient } from "@/lib/supabase/client";
import { SidebarToggleProvider } from "./SidebarToggleContext";
import { ZIndexDebugger } from "@/components/dev/ZIndexDebugger";

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
                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={toggleSidebar}
                    onLogout={handleLogout}
                    onChangePassword={handleChangePassword}
                />

                <main className="flex-1 p-2 md:p-4 lg:pl-64">{children}</main>

                {/* Z-Index Debugger - Development only */}
                <ZIndexDebugger />
            </div>
        </SidebarToggleProvider>
    );
}
