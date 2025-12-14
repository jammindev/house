"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AIContextBadgeProps {
    label: string;
    meta?: string;
    className?: string;
}

export function AIContextBadge({ label, meta, className }: AIContextBadgeProps) {
    return (
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
            <Badge variant="outline" className="gap-1 px-2 py-1 text-[11px] font-medium">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="leading-none">AI</span>
            </Badge>
            <span className="truncate">{label}</span>
            {meta ? <span className="text-muted-foreground/70">· {meta}</span> : null}
        </div>
    );
}
