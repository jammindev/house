// nextjs/src/components/layout/Sidebar.tsx
"use client";

import { useTransition, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    Home,
    Notebook,
    Users,
    MapPin,
    Files,
    FileText,
    Image as ImageIcon,
    LucideListTodo,
    User,
    LogOut,
    Key,
    X,
    Building2,
    LayoutDashboard,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import UserAvatar from "./UserAvatar";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    onChangePassword: () => void;
}

export default function Sidebar({
    isOpen,
    onClose,
    onLogout,
    onChangePassword,
}: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useGlobal();
    const { t } = useI18n();
    const [isPending, startTransition] = useTransition();
    const [loadingRoute, setLoadingRoute] = useState<string | null>(null);

    const navigation = [
        { name: t("nav.dashboard"), href: "/app", icon: Home },
        { name: t("nav.interactions"), href: "/app/interactions", icon: Notebook },
        { name: t("nav.projects"), href: "/app/projects", icon: LayoutDashboard },
        { name: t("nav.contacts"), href: "/app/contacts", icon: Users },
        { name: t("nav.structures"), href: "/app/structures", icon: Building2 },
        { name: t("nav.zones"), href: "/app/zones", icon: MapPin },
        { name: t("nav.documents"), href: "/app/documents", icon: FileText },
        { name: t("nav.photos"), href: "/app/photos", icon: ImageIcon },
        { name: t("nav.storage"), href: "/app/storage", icon: Files },
        { name: t("nav.table"), href: "/app/table", icon: LucideListTodo },
        { name: t("nav.userSettings"), href: "/app/user-settings", icon: User },
    ];

    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    const handleNavigate = (href: string) => {
        onClose();
        setLoadingRoute(href);
        startTransition(() => {
            router.push(href);
        });
    };

    return (
        <>
            <div
                className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out z-30 
        ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b">
                    <span className="text-xl font-semibold text-primary-600">
                        {productName}
                    </span>
                    <button
                        onClick={onClose}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* User (mobile) */}
                <div className="flex items-center gap-3 px-4 py-3 border-b lg:hidden">
                    <UserAvatar email={user?.email} />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 truncate">
                            {user?.email || "Utilisateur"}
                        </span>
                        <button
                            onClick={onLogout}
                            className="text-xs text-red-600 hover:underline"
                        >
                            {t("nav.signOut")}
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="mt-4 px-2 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        const isLoadingThisRoute = isPending && loadingRoute === item.href;

                        return (
                            <button
                                key={item.name}
                                onClick={() => handleNavigate(item.href)}
                                disabled={isLoadingThisRoute}
                                className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md transition-all ${isActive
                                    ? "bg-primary-50 text-primary-600"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    } ${isLoadingThisRoute ? "opacity-50 cursor-wait" : ""}`}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 ${isActive
                                        ? "text-primary-500"
                                        : "text-gray-400 group-hover:text-gray-500"
                                        }`}
                                />
                                {item.name}
                            </button>
                        );
                    })}
                </nav>

                {/* Actions (desktop only) */}
                <div className="hidden lg:block mt-auto border-t p-3">
                    <button
                        onClick={onChangePassword}
                        className="flex items-center w-full px-2 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        <Key className="mr-3 h-4 w-4 text-gray-400" />
                        {t("nav.changePassword")}
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex items-center w-full px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                        <LogOut className="mr-3 h-4 w-4 text-red-400" />
                        {t("nav.signOut")}
                    </button>
                </div>
            </div>
        </>
    );
}
