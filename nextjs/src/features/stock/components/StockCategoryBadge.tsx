// nextjs/src/features/stock/components/StockCategoryBadge.tsx
"use client";

import { cn } from "@/lib/utils";
import type { StockCategory } from "../types";

type Props = {
    category: Pick<StockCategory, "name" | "color" | "emoji">;
    className?: string;
    size?: "sm" | "md";
};

export default function StockCategoryBadge({ category, className, size = "md" }: Props) {
    // Create a lighter background from the category color
    const bgStyle = {
        backgroundColor: `${category.color}20`,
        borderColor: `${category.color}40`,
        color: category.color,
    };

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border font-medium",
                size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
                className
            )}
            style={bgStyle}
        >
            <span>{category.emoji}</span>
            <span>{category.name}</span>
        </span>
    );
}
