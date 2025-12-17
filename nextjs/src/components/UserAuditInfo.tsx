"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAuditInfoProps = {
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  fallbackText?: string;
};

function getInitials(username?: string | null, email?: string | null): string {
  if (username && username.trim().length > 0) {
    const parts = username.trim().split(/\s+/);
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0].slice(0, Math.min(2, parts[0].length)).toUpperCase();
    }
    if (parts.length > 1 && parts[0].length > 0 && parts[1].length > 0) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
  }
  if (email) {
    const emailParts = email.split("@")[0].split(/[._-]/);
    if (emailParts.length > 1 && emailParts[0].length > 0 && emailParts[1].length > 0) {
      return (emailParts[0][0] + emailParts[1][0]).toUpperCase();
    }
    if (emailParts.length > 0 && emailParts[0].length > 0) {
      return emailParts[0].slice(0, Math.min(2, emailParts[0].length)).toUpperCase();
    }
  }
  return "??";
}

export default function UserAuditInfo({
  username,
  email,
  avatarUrl,
  fallbackText,
}: UserAuditInfoProps) {
  const displayName = username ?? email ?? fallbackText ?? "Unknown User";
  const initials = getInitials(username, email);

  return (
    <span className="inline-flex items-center gap-2">
      <Avatar className="h-5 w-5">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span>{displayName}</span>
    </span>
  );
}
