// nextjs/src/components/layout/UserDropdown.tsx
import { useState } from "react";
import { ChevronDown, Key, LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import UserAvatar from "./UserAvatar";
import type { User } from "@/lib/context/GlobalContext";

type UserDropdownProps = {
  user: User | null;
  onLogout: () => void;
  onChangePassword: () => void;
};

export default function UserDropdown({ user, onLogout, onChangePassword }: UserDropdownProps) {
    const [isOpen, setOpen] = useState(false);
    const { t } = useI18n();
    const mainLabel =
        (user?.displayName && user.displayName.trim().length > 0 ? user.displayName : null) ??
        user?.email ??
        "Loading...";

    return (
        <div className="relative ml-auto">
            <button
                onClick={() => setOpen(!isOpen)}
                className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
            >
                <UserAvatar email={user?.email} displayName={user?.displayName} avatarUrl={user?.avatarUrl} />
                <span className="max-w-[160px] truncate">{mainLabel}</span>
                <ChevronDown className="h-4 w-4" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border">
                    <div className="p-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">{t("nav.signedInAs")}</p>
                        {user?.displayName ? (
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                        ) : (
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                        )}
                    </div>
                    <div className="py-1">
                        <button
                            onClick={() => {
                                setOpen(false);
                                onChangePassword();
                            }}
                            className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Key className="mr-3 h-4 w-4 text-gray-400" />
                            {t("nav.changePassword")}
                        </button>
                        <button
                            onClick={() => {
                                onLogout();
                                setOpen(false);
                            }}
                            className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                            <LogOut className="mr-3 h-4 w-4 text-red-400" />
                            {t("nav.signOut")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
