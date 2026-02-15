// nextjs/src/features/stock/components/StockList.tsx
"use client";

import { Package, MapPin, Calendar, AlertTriangle } from "lucide-react";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import StockStatusBadge from "./StockStatusBadge";
import StockCategoryBadge from "./StockCategoryBadge";
import type { StockItem } from "../types";

type Props = {
    items: StockItem[];
    t: (key: string, args?: Record<string, string | number>) => string;
};

const formatDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
};

const formatQuantity = (quantity: number, unit: string) => {
    // Format number with max 2 decimal places, removing trailing zeros
    const formatted = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted} ${unit}`;
};

export default function StockList({ items, t }: Props) {
    const today = new Date();

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
                const isLowStock = item.status === "low_stock" || item.status === "out_of_stock";
                const isExpiringSoon =
                    item.expiration_date &&
                    new Date(item.expiration_date) <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                const isExpired = item.expiration_date && new Date(item.expiration_date) < today;

                return (
                    <LinkWithOverlay
                        key={item.id}
                        href={`/app/stock/${item.id}`}
                        className="group relative block h-full rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm ring-1 ring-transparent transition hover:border-indigo-200 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                                {item.category && (
                                    <StockCategoryBadge category={item.category} size="sm" />
                                )}
                                <h3 className="truncate text-lg font-semibold text-gray-900">{item.name}</h3>
                                {item.zone && (
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                        <span className="truncate">{item.zone.name}</span>
                                    </div>
                                )}
                            </div>
                            <StockStatusBadge status={item.status} t={t} />
                        </div>

                        {/* Quantity display */}
                        <div className="mt-4 flex items-baseline gap-2">
                            <Package className="h-5 w-5 text-gray-400" />
                            <span
                                className={`text-2xl font-bold ${isLowStock ? "text-rose-600" : "text-gray-900"
                                    }`}
                            >
                                {formatQuantity(item.quantity, item.unit)}
                            </span>
                            {item.min_quantity != null && item.min_quantity > 0 && (
                                <span className="text-sm text-gray-500">
                                    / {t("stock.fields.minQty")}: {item.min_quantity}
                                </span>
                            )}
                        </div>

                        {/* Alerts and metadata */}
                        <div className="mt-4 space-y-2">
                            {(isExpiringSoon || isExpired) && item.expiration_date && (
                                <div
                                    className={`flex items-center gap-2 text-xs ${isExpired ? "text-rose-700" : "text-amber-700"
                                        }`}
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>
                                        {isExpired
                                            ? t("stock.fields.expired")
                                            : t("stock.fields.expiresOn", { date: formatDate(item.expiration_date) ?? "" })}
                                    </span>
                                </div>
                            )}

                            {item.unit_price != null && (
                                <div className="flex items-center justify-between text-xs text-gray-600">
                                    <span>{t("stock.fields.unitPrice")}</span>
                                    <span className="font-medium">
                                        {item.unit_price.toLocaleString(undefined, {
                                            style: "currency",
                                            currency: "EUR",
                                        })}
                                    </span>
                                </div>
                            )}

                            {item.total_value != null && item.total_value > 0 && (
                                <div className="flex items-center justify-between text-xs text-gray-600">
                                    <span>{t("stock.fields.totalValue")}</span>
                                    <span className="font-medium">
                                        {item.total_value.toLocaleString(undefined, {
                                            style: "currency",
                                            currency: "EUR",
                                        })}
                                    </span>
                                </div>
                            )}

                            {item.supplier && (
                                <div className="truncate text-xs text-gray-500">
                                    {t("stock.fields.supplier")}: {item.supplier}
                                </div>
                            )}
                        </div>
                    </LinkWithOverlay>
                );
            })}
        </div>
    );
}
