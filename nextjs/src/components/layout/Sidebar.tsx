// nextjs/src/components/layout/Sidebar.tsx
"use client";

import { useEffect, useState, MouseEvent } from "react";
import { usePathname } from "next/navigation";
import {
    Home,
    BookOpen,
    Notebook,
    Users,
    MapPin,
    FileText,
    Image as ImageIcon,
    LucideListTodo,
    User,
    LogOut,
    Key,
    X,
    FolderKanban,
    LayoutDashboard,
    Wrench,
    Bug,
    Shield,
    Warehouse,
    ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import UserAvatar from "./UserAvatar";
import LinkWithOverlay from "./LinkWithOverlay";
import { Button } from "../ui/button";
import { useAdminContext } from "@/features/admin/hooks/useAdmin";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    onChangePassword: () => void;
    footer?: React.ReactNode;
}

export default function Sidebar({
    isOpen,
    onClose,
    onLogout,
    onChangePassword,
}: SidebarProps) {
    const pathname = usePathname();
    const { user } = useGlobal();
    const { t } = useI18n();
    const [loadingRoute, setLoadingRoute] = useState<string | null>(null);
    const { isAdmin } = useAdminContext();

    useEffect(() => {
        setLoadingRoute(null);
    }, [pathname]);

    const navigation = [
        { name: t("nav.dashboard"), href: "/app/dashboard", icon: Home },
        { name: t("nav.tasks"), href: "/app/tasks", icon: LucideListTodo },
        { name: t("nav.projectGroups"), href: "/app/project-groups", icon: FolderKanban },
        { name: t("nav.projects"), href: "/app/projects", icon: LayoutDashboard },
        { name: t("nav.equipment"), href: "/app/equipment", icon: Wrench },
        { name: t("nav.stock"), href: "/app/stock", icon: Warehouse },
        { name: t("nav.insurance"), href: "/app/insurance", icon: ShieldCheck },
        { name: t("nav.zones"), href: "/app/zones", icon: MapPin },
        { name: t("nav.directory"), href: "/app/repertoire", icon: Users },
        { name: t("nav.documents"), href: "/app/documents", icon: FileText },
        { name: t("nav.photos"), href: "/app/photos", icon: ImageIcon },
        { name: t("nav.interactions"), href: "/app/interactions", icon: Notebook },
        { name: t("nav.userSettings"), href: "/app/user-settings", icon: User },
        { name: t("nav.tutorial"), href: "/app/tutorial", icon: BookOpen },
        ...(isAdmin ? [
            { name: "Administration", href: "/admin", icon: Shield }
        ] : []),
        ...(process.env.NODE_ENV === 'development' ? [
            { name: "Debug", href: "/app/debug", icon: Bug }
        ] : [])
    ];

    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    const handleLinkClick = (
        event: MouseEvent<HTMLAnchorElement>,
        href: string,
        isDisabled: boolean,
    ) => {
        if (isDisabled) {
            event.preventDefault();
            return;
        }

        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.altKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button !== 0
        ) {
            // Let the browser handle modified clicks (new tab/window)
            return;
        }

        onClose();
        setLoadingRoute(href);
    };

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-overlay-backdrop lg:hidden transition-all duration-300"
                    onClick={onClose}
                />
            )}

            <div
                className={`fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-white/95 to-white/90 backdrop-blur-2xl border-r border-gray-200/50 shadow-2xl transform transition-all duration-300 ease-out z-overlay-drawer flex flex-col justify-between
        ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
            >
                <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200/60 backdrop-blur-xl bg-white/50">
                    <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                        {productName}
                    </span>
                    <button
                        onClick={onClose}
                        className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition-all duration-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 mt-3 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300/50 scrollbar-track-transparent">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        const isLoadingThisRoute = loadingRoute === item.href;
                        const isDisabled = isLoadingThisRoute || isActive;

                        return (
                            <LinkWithOverlay
                                key={item.name}
                                href={item.href}
                                onClick={(event) =>
                                    handleLinkClick(event, item.href, isDisabled)
                                }
                                className={`group flex items-center w-full px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-300 ease-out ${isActive
                                    ? "bg-gradient-to-br from-primary-500/10 to-primary-600/5 text-primary-700 shadow-sm border border-primary-200/50 backdrop-blur-sm"
                                    : "text-gray-600 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm active:scale-[0.98]"
                                    } ${isDisabled ? "opacity-40 cursor-wait pointer-events-none" : ""}`}
                                aria-disabled={isDisabled}
                                tabIndex={isDisabled ? -1 : undefined}
                                prefetch
                                disabled={isDisabled}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 transition-all duration-300 ${isActive
                                        ? "text-primary-600 scale-110"
                                        : "text-gray-400 group-hover:text-gray-600 group-hover:scale-105"
                                        }`}
                                />
                                {item.name}
                            </LinkWithOverlay>
                        );
                    })}
                </nav>

                {/* Footer: slot to add custom components, pinned to bottom */}
                <div className="border-t border-gray-200/60 p-4 bg-gradient-to-t from-white/60 to-transparent backdrop-blur-xl">
                    {/* User (mobile) */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 lg:hidden p-3 rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-200/40 shadow-sm hover:shadow-md transition-all duration-300">
                            <UserAvatar email={user?.email} displayName={user?.displayName} avatarUrl={user?.avatarUrl} />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                    {user?.displayName && user.displayName.trim().length > 0
                                        ? user.displayName
                                        : user?.email || "Utilisateur"}
                                </span>
                            </div>
                        </div>
                        <Button
                            onClick={onLogout}
                            variant={"outline"}
                            className="w-full"
                        >
                            {t("nav.signOut")}
                        </Button>
                    </div>

                    {/* Actions (desktop only) */}
                    <div className="hidden lg:block mt-3 pt-3 border-t border-gray-200/40 space-y-1">
                        <button
                            onClick={onChangePassword}
                            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 rounded-xl transition-all duration-200 active:scale-[0.98]"
                        >
                            <Key className="mr-3 h-4 w-4 text-gray-400" />
                            {t("nav.changePassword")}
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50/80 hover:text-red-700 rounded-xl transition-all duration-200 active:scale-[0.98] backdrop-blur-sm"
                        >
                            <LogOut className="mr-3 h-4 w-4 text-red-400" />
                            {t("nav.signOut")}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
