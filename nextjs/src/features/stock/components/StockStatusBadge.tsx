// nextjs/src/features/stock/components/StockStatusBadge.tsx
"use client";

import { cn } from "@/lib/utils";
import type { StockItemStatus } from "../types";
import { STOCK_STATUS_COLORS } from "../constants";

type Props = {
    status: StockItemStatus;
    t: (key: string) => string;
    className?: string;
};

export default function StockStatusBadge({ status, t, className }: Props) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                STOCK_STATUS_COLORS[status],
                className
            )}
        >
            {t(`stock.status.${status}`)}
        </span>
    );
}
