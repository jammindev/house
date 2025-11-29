"use client";

import { cn } from "@/lib/utils";

interface ActiveIndicatorProps {
  className?: string;
}

export default function ActiveIndicator({ className }: ActiveIndicatorProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-primary ring-2 ring-background",
        className
      )}
    />
  );
}
