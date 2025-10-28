// nextjs/src/components/layout/AppLayout.tsx
"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";
import { Button } from "../ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [, startTransition] = useTransition();
    const router = useRouter();

    const { user, households, selectedHouseholdId, setSelectedHouseholdId } = useGlobal();
    const currentHousehold = useMemo(
        () => households.find((h) => h.id === selectedHouseholdId) || null,
        [households, selectedHouseholdId]
    );

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
        <div className="min-h-screen p-2 md:p-0 bg-gray-100 flex flex-col relative">
            {/* Floating button (mobile) */}
            <Button
                size="icon"
                variant="ghost"
                onClick={toggleSidebar}
                aria-label="Open navigation"
                className="lg:hidden absolute top-2 left-4 lg:left-8 lg:top-8 z-30 rounded-full bg-white/90 border border-gray-200 shadow-md p-2 text-gray-600 opacity-80"
            >
                <Menu className="h-6 w-6" />
            </Button>

            {/* Overlay (mobile) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={toggleSidebar}
                onLogout={handleLogout}
                onChangePassword={handleChangePassword}
            />

            <TopBar
                user={user}
                households={households}
                selectedHouseholdId={selectedHouseholdId}
                currentHousehold={currentHousehold}
                onSelectHousehold={setSelectedHouseholdId}
                onLogout={handleLogout}
                onChangePassword={handleChangePassword}
            />

            <main className="md:p-4 pb-16 lg:pb-4 lg:pl-64">{children}</main>
        </div>
    );
}
