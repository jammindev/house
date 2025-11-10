"use client";

import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface CountBadgeProps {
    icon?: React.ReactNode;
    /** Optional numeric count to show */
    count?: number | null;
    /** Optional label/title for the badge. When `display` is `inline` it will be shown, when `tooltip` it will be shown in a Tooltip. */
    label?: string;
    /** How to show the label */
    display?: "inline" | "tooltip";
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
}

export default function CountBadge({
    icon,
    count,
    label,
    display = "tooltip",
    onClick,
    className = "",
}: CountBadgeProps) {
    const base =
        "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600";

    const content = (
        <>
            {icon ? <span aria-hidden className="flex items-center">{icon}</span> : null}
            {typeof count === "number" ? <span className="font-semibold">{count}</span> : null}
            {display === "inline" && label ? <span className="ml-1">{label}</span> : null}
        </>
    );

    const cursorClass = onClick ? "cursor-pointer" : "";

    const el = onClick ? (
        <button
            type="button"
            onClick={onClick}
            aria-label={label ?? undefined}
            className={`${base} ${cursorClass} ${className}`.trim()}
        >
            {content}
        </button>
    ) : (
        <span aria-label={label ?? undefined} className={`${base} ${className}`.trim()}>
            {content}
        </span>
    );

    if (display === "tooltip" && label) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{el}</TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
        );
    }
    return el;
}
