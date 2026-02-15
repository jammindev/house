// nextjs/src/features/_shared/components/VisibilityBadge.tsx
"use client";

import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisibilityBadgeProps {
  isPrivate: boolean;
  className?: string;
  size?: "sm" | "md";
}

export default function VisibilityBadge({ isPrivate, className, size = "md" }: VisibilityBadgeProps) {
  if (!isPrivate) return null;

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <EyeOff className={cn("text-gray-500", iconSize, className)} />
  );
}
