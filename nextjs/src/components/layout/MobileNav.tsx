// nextjs/src/components/layout/MobileNav.tsx
import Link from "next/link";
import { Menu, Home, Notebook, MapPin, Files, LucideListTodo } from "lucide-react";

export default function MobileNav({
    pathname,
    onMenuClick,
}: {
    pathname: string;
    onMenuClick: () => void;
}) {
    const mobileNav = [
        { href: "/app", icon: Home },
        { href: "/app/entries", icon: Notebook },
        { href: "/app/zones", icon: MapPin },
        { href: "/app/storage", icon: Files },
        { href: "/app/table", icon: LucideListTodo },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-inner flex justify-around items-center h-20 pb-2 lg:hidden">
            {mobileNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex flex-col items-center justify-center text-gray-500 hover:text-primary-600"
                    >
                        <item.icon className={`h-6 w-6 ${isActive ? "text-primary-600" : ""}`} />
                    </Link>
                );
            })}
            <button
                onClick={onMenuClick}
                className="flex flex-col items-center justify-center text-gray-500 hover:text-primary-600"
            >
                <Menu className="h-6 w-6" />
            </button>
        </nav>
    );
}