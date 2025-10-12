// nextjs/src/components/layout/AppLayout.tsx
"use client";
import React, { useState, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useI18n();

    const { user, households, selectedHouseholdId, setSelectedHouseholdId } = useGlobal();
    const currentHousehold = useMemo(
        () => households.find((h) => h.id === selectedHouseholdId) || null,
        [households, selectedHouseholdId]
    );

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const handleChangePassword = () => router.push("/app/user-settings");
    const toggleSidebar = () => setSidebarOpen((prev) => !prev);

    return (
        <div className="min-h-screen p-2 md:p-0 bg-gray-100 flex flex-col">
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

            <main className="md:p-4 pb-20 lg:pb-4 lg:pl-64">{children}</main>

            <MobileNav pathname={pathname} onMenuClick={toggleSidebar} />
        </div>
    );
}