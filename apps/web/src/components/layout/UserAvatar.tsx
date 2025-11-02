// nextjs/src/components/layout/UserAvatar.tsx
export default function UserAvatar({
    email,
    displayName,
    avatarUrl,
}: {
    email?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
}) {
    const getInitials = (name?: string | null, fallbackEmail?: string) => {
        if (name && name.trim().length > 0) {
            const parts = name.trim().split(/\s+/);
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        if (!fallbackEmail) return "??";
        const emailParts = fallbackEmail.split("@")[0].split(/[._-]/);
        return emailParts.length > 1
            ? (emailParts[0][0] + emailParts[1][0]).toUpperCase()
            : emailParts[0].slice(0, 2).toUpperCase();
    };

    if (avatarUrl) {
        return (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt={displayName ?? email ?? "Avatar"} className="w-full h-full object-cover" />
            </div>
        );
    }

    return (
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-medium">{getInitials(displayName, email)}</span>
        </div>
    );
}
