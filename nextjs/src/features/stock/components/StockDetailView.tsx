// nextjs/src/features/stock/components/StockDetailView.tsx
"use client";

import { useState } from "react";
import {
    Package,
    MapPin,
    Calendar,
    AlertTriangle,
    Truck,
    Barcode,
    Tag,
    Plus,
    Minus,
    Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import StockStatusBadge from "./StockStatusBadge";
import StockCategoryBadge from "./StockCategoryBadge";
import type { StockItem } from "../types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
    item: StockItem;
    onDeleted: () => void;
    onQuantityAdjusted: (delta: number) => Promise<void>;
    t: (key: string, args?: Record<string, string | number>) => string;
    locale: string;
};

const formatDate = (value?: string | null, locale?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(locale);
};

const formatCurrency = (value: number | null, locale?: string) => {
    if (value == null) return null;
    return value.toLocaleString(locale, { style: "currency", currency: "EUR" });
};

const formatQuantity = (quantity: number, unit: string) => {
    const formatted = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(3).replace(/\.?0+$/, "");
    return `${formatted} ${unit}`;
};

export default function StockDetailView({
    item,
    onDeleted,
    onQuantityAdjusted,
    t,
    locale,
}: Props) {
    const [adjustQty, setAdjustQty] = useState("1");
    const [adjusting, setAdjusting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isLowStock = item.status === "low_stock" || item.status === "out_of_stock";
    const today = new Date();
    const isExpired = item.expiration_date && new Date(item.expiration_date) < today;
    const isExpiringSoon =
        item.expiration_date &&
        !isExpired &&
        new Date(item.expiration_date) <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const handleAdjust = async (delta: number) => {
        const qty = parseFloat(adjustQty) || 1;
        setAdjusting(true);
        try {
            await onQuantityAdjusted(delta * qty);
        } finally {
            setAdjusting(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            onDeleted();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    {item.category && <StockCategoryBadge category={item.category} />}
                    <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
                    {item.zone && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin className="h-4 w-4" />
                            <LinkWithOverlay href={`/app/zones/${item.zone.id}`} className="hover:underline">
                                {item.zone.name}
                            </LinkWithOverlay>
                        </div>
                    )}
                </div>
                <StockStatusBadge status={item.status} t={t} className="self-start" />
            </div>

            {/* Alerts */}
            {(isExpired || isExpiringSoon || isLowStock) && (
                <div className="space-y-2">
                    {isExpired && (
                        <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            <AlertTriangle className="h-5 w-5" />
                            <span>{t("stock.alerts.expired")}</span>
                        </div>
                    )}
                    {isExpiringSoon && !isExpired && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <AlertTriangle className="h-5 w-5" />
                            <span>
                                {t("stock.alerts.expiringSoon", {
                                    date: formatDate(item.expiration_date, locale) ?? "",
                                })}
                            </span>
                        </div>
                    )}
                    {isLowStock && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <Package className="h-5 w-5" />
                            <span>{t("stock.alerts.lowStock")}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Quantity management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {t("stock.sections.quantity")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p
                                className={`text-4xl font-bold ${isLowStock ? "text-rose-600" : "text-gray-900"
                                    }`}
                            >
                                {formatQuantity(item.quantity, item.unit)}
                            </p>
                            {item.min_quantity != null && (
                                <p className="text-sm text-gray-500">
                                    {t("stock.fields.minQty")}: {item.min_quantity} {item.unit}
                                </p>
                            )}
                            {item.max_quantity != null && (
                                <p className="text-sm text-gray-500">
                                    {t("stock.fields.maxQty")}: {item.max_quantity} {item.unit}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleAdjust(-1)}
                                disabled={adjusting || item.quantity <= 0}
                                aria-label={t("stock.actions.decrease")}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                                type="number"
                                value={adjustQty}
                                onChange={(e) => setAdjustQty(e.target.value)}
                                className="w-20 text-center"
                                min="0.001"
                                step="0.001"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleAdjust(1)}
                                disabled={adjusting}
                                aria-label={t("stock.actions.increase")}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {item.unit_price != null && (
                        <>
                            <Separator className="my-4" />
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">{t("stock.fields.unitPrice")}</p>
                                    <p className="font-medium">{formatCurrency(item.unit_price, locale)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">{t("stock.fields.totalValue")}</p>
                                    <p className="font-medium">{formatCurrency(item.total_value, locale)}</p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Description */}
            {item.description && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("stock.sections.description")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-gray-700">{item.description}</p>
                    </CardContent>
                </Card>
            )}

            {/* Details */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("stock.sections.details")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {item.supplier && (
                            <div>
                                <dt className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Truck className="h-4 w-4" />
                                    {t("stock.fields.supplier")}
                                </dt>
                                <dd className="mt-1 font-medium text-gray-900">{item.supplier}</dd>
                            </div>
                        )}

                        {item.purchase_date && (
                            <div>
                                <dt className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Calendar className="h-4 w-4" />
                                    {t("stock.fields.purchaseDate")}
                                </dt>
                                <dd className="mt-1 font-medium text-gray-900">
                                    {formatDate(item.purchase_date, locale)}
                                </dd>
                            </div>
                        )}

                        {item.expiration_date && (
                            <div>
                                <dt className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Calendar className="h-4 w-4" />
                                    {t("stock.fields.expirationDate")}
                                </dt>
                                <dd
                                    className={`mt-1 font-medium ${isExpired ? "text-rose-600" : isExpiringSoon ? "text-amber-600" : "text-gray-900"
                                        }`}
                                >
                                    {formatDate(item.expiration_date, locale)}
                                </dd>
                            </div>
                        )}

                        {item.last_restocked_at && (
                            <div>
                                <dt className="text-sm text-gray-500">{t("stock.fields.lastRestocked")}</dt>
                                <dd className="mt-1 font-medium text-gray-900">
                                    {formatDate(item.last_restocked_at, locale)}
                                </dd>
                            </div>
                        )}

                        {item.sku && (
                            <div>
                                <dt className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Barcode className="h-4 w-4" />
                                    {t("stock.fields.sku")}
                                </dt>
                                <dd className="mt-1 font-mono text-gray-900">{item.sku}</dd>
                            </div>
                        )}

                        {item.barcode && (
                            <div>
                                <dt className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Barcode className="h-4 w-4" />
                                    {t("stock.fields.barcode")}
                                </dt>
                                <dd className="mt-1 font-mono text-gray-900">{item.barcode}</dd>
                            </div>
                        )}
                    </dl>

                    {item.tags && item.tags.length > 0 && (
                        <>
                            <Separator className="my-4" />
                            <div>
                                <dt className="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
                                    <Tag className="h-4 w-4" />
                                    {t("stock.fields.tags")}
                                </dt>
                                <dd className="flex flex-wrap gap-2">
                                    {item.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </dd>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Notes */}
            {item.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("stock.sections.notes")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-gray-700">{item.notes}</p>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("stock.actions.delete")}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("stock.deleteTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("stock.deleteDescription", { name: item.name })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                                {deleting ? t("common.deleting") : t("common.delete")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            {/* Metadata */}
            <div className="text-xs text-gray-400">
                <p>
                    {t("stock.meta.created", { date: formatDate(item.created_at, locale) ?? "" })}
                </p>
                {item.updated_at !== item.created_at && (
                    <p>
                        {t("stock.meta.updated", { date: formatDate(item.updated_at, locale) ?? "" })}
                    </p>
                )}
            </div>
        </div>
    );
}
