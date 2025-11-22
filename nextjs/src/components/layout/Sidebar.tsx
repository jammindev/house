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
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import UserAvatar from "./UserAvatar";
import LinkWithOverlay from "./LinkWithOverlay";

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
    const pathname = usePathname();
    const { user } = useGlobal();
    const { t } = useI18n();
    const [loadingRoute, setLoadingRoute] = useState<string | null>(null);

    useEffect(() => {
        setLoadingRoute(null);
    }, [pathname]);

    const navigation = [
        { name: t("nav.dashboard"), href: "/app", icon: Home },
        { name: t("nav.projectGroups"), href: "/app/project-groups", icon: FolderKanban },
        { name: t("nav.projects"), href: "/app/projects", icon: LayoutDashboard },
        { name: t("nav.interactions"), href: "/app/interactions", icon: Notebook },
        { name: t("nav.zones"), href: "/app/zones", icon: MapPin },
        { name: t("nav.directory"), href: "/app/repertoire", icon: Users },
        { name: t("nav.documents"), href: "/app/documents", icon: FileText },
        { name: t("nav.photos"), href: "/app/photos", icon: ImageIcon },
        // { name: t("nav.tasks"), href: "/app/tasks", icon: LucideListTodo },
        { name: t("nav.userSettings"), href: "/app/user-settings", icon: User },
        { name: t("nav.tutorial"), href: "/app/tutorial", icon: BookOpen },
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
                    <UserAvatar email={user?.email} displayName={user?.displayName} avatarUrl={user?.avatarUrl} />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 truncate">
                            {user?.displayName && user.displayName.trim().length > 0
                                ? user.displayName
                                : user?.email || "Utilisateur"}
                        </span>
                        {user?.displayName && user.email && (
                            <span className="text-xs text-gray-500 truncate">{user.email}</span>
                        )}
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
                        const isLoadingThisRoute = loadingRoute === item.href;
                        const isDisabled = isLoadingThisRoute || isActive;

                        return (
                            <LinkWithOverlay
                                key={item.name}
                                href={item.href}
                                onClick={(event) =>
                                    handleLinkClick(event, item.href, isDisabled)
                                }
                                className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md transition-all ${isActive
                                    ? "bg-primary-50 text-primary-600"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    } ${isDisabled ? "opacity-50 cursor-wait pointer-events-none" : ""}`}
                                aria-disabled={isDisabled}
                                tabIndex={isDisabled ? -1 : undefined}
                                prefetch
                                disabled={isDisabled}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 ${isActive
                                        ? "text-primary-500"
                                        : "text-gray-400 group-hover:text-gray-500"
                                        }`}
                                />
                                {item.name}
                            </LinkWithOverlay>
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
