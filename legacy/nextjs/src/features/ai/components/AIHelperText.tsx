"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIHelperTextProps {
    children: React.ReactNode;
    className?: string;
}

export function AIHelperText({ children, className }: AIHelperTextProps) {
    return (
        <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}
