// nextjs/src/components/layout/UserAvatar.tsx
export default function UserAvatar({ email }: { email?: string }) {
    const getInitials = (email?: string) => {
        if (!email) return "??";
        const parts = email.split("@")[0].split(/[._-]/);
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    return (
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-medium">{getInitials(email)}</span>
        </div>
    );
}