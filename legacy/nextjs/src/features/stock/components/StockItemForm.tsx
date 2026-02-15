// nextjs/src/features/stock/components/StockItemForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useZones } from "@zones/hooks/useZones";
import { useStockCategories } from "../hooks/useStockCategories";
import type { StockItem, StockItemPayload } from "../types";
import { STOCK_ITEM_STATUSES, DEFAULT_UNITS } from "../constants";

type Props = {
    item?: StockItem | null;
    onSaved?: (id: string) => void;
    mode?: "create" | "edit";
    defaultCategoryId?: string;
};

type FormValues = {
    name: string;
    category_id: string;
    zone_id: string;
    description: string;
    sku: string;
    barcode: string;
    quantity: string;
    unit: string;
    min_quantity: string;
    max_quantity: string;
    unit_price: string;
    purchase_date: string;
    expiration_date: string;
    status: StockItem["status"];
    supplier: string;
    notes: string;
    tags_input: string;
};

const toNullable = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const parseNumber = (value: string) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export default function StockItemForm({ item, onSaved, mode = "create", defaultCategoryId }: Props) {
    const { selectedHouseholdId: householdId } = useGlobal();
    const { t } = useI18n();
    const { show } = useToast();
    const { zones, loading: zonesLoading } = useZones();
    const { categories, loading: categoriesLoading } = useStockCategories();
    const [serverError, setServerError] = useState<string | null>(null);

    const defaultValues = useMemo<FormValues>(
        () => ({
            name: item?.name ?? "",
            category_id: item?.category_id ?? defaultCategoryId ?? "",
            zone_id: item?.zone_id ?? "none",
            description: item?.description ?? "",
            sku: item?.sku ?? "",
            barcode: item?.barcode ?? "",
            quantity: item?.quantity != null ? String(item.quantity) : "0",
            unit: item?.unit ?? "unit",
            min_quantity: item?.min_quantity != null ? String(item.min_quantity) : "",
            max_quantity: item?.max_quantity != null ? String(item.max_quantity) : "",
            unit_price: item?.unit_price != null ? String(item.unit_price) : "",
            purchase_date: item?.purchase_date ?? "",
            expiration_date: item?.expiration_date ?? "",
            status: item?.status ?? "in_stock",
            supplier: item?.supplier ?? "",
            notes: item?.notes ?? "",
            tags_input: (item?.tags ?? []).join(", "),
        }),
        [item, defaultCategoryId]
    );

    const {
        control,
        register,
        handleSubmit,
        formState: { isSubmitting, errors },
        reset,
        setError,
    } = useForm<FormValues>({ defaultValues });

    useEffect(() => {
        reset(defaultValues);
    }, [defaultValues, reset]);

    const onSubmit = async (values: FormValues) => {
        if (!householdId) {
            setServerError(t("stock.errors.noHousehold"));
            return;
        }
        if (!values.name.trim()) {
            setError("name", { type: "required", message: t("stock.errors.nameRequired") });
            return;
        }
        if (!values.category_id) {
            setError("category_id", { type: "required", message: t("stock.errors.categoryRequired") });
            return;
        }

        setServerError(null);

        const tags = values.tags_input
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        const payload: StockItemPayload = {
            household_id: item?.household_id ?? householdId,
            category_id: values.category_id,
            zone_id: values.zone_id === "none" ? null : values.zone_id,
            name: values.name.trim(),
            description: values.description.trim(),
            sku: values.sku.trim(),
            barcode: values.barcode.trim(),
            quantity: parseNumber(values.quantity) ?? 0,
            unit: values.unit.trim() || "unit",
            min_quantity: parseNumber(values.min_quantity),
            max_quantity: parseNumber(values.max_quantity),
            unit_price: parseNumber(values.unit_price),
            purchase_date: values.purchase_date || null,
            expiration_date: values.expiration_date || null,
            last_restocked_at: item?.last_restocked_at ?? null,
            status: values.status,
            supplier: values.supplier.trim(),
            notes: values.notes.trim(),
            tags,
        };

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();
            let savedId: string | null = null;

            if (item) {
                const { data, error: updateError } = await client
                    .from("stock_items")
                    .update(payload)
                    .eq("id", item.id)
                    .select("id")
                    .single();
                if (updateError) throw updateError;
                savedId = data?.id ?? item.id;
                show({ title: t("stock.updateSuccess"), variant: "default" });
            } else {
                const { data, error: insertError } = await client
                    .from("stock_items")
                    .insert(payload)
                    .select("id")
                    .single();
                if (insertError) throw insertError;
                savedId = data?.id ?? null;
                show({ title: t("stock.createSuccess"), variant: "default" });
            }

            if (!savedId) {
                throw new Error("Failed to save stock item");
            }
            if (onSaved) onSaved(savedId);
        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : t("common.unexpectedError");
            setServerError(message);
            show({ title: t("stock.saveFailed"), variant: "destructive" });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {serverError && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {serverError}
                </div>
            )}

            {/* Basic info */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("stock.sections.general")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t("stock.fields.name")} *</Label>
                        <Input
                            id="name"
                            {...register("name", { required: true })}
                            placeholder={t("stock.fields.namePlaceholder")}
                        />
                        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">{t("stock.fields.category")} *</Label>
                        <Controller
                            control={control}
                            name="category_id"
                            rules={{ required: true }}
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={categoriesLoading || categories.length === 0}
                                >
                                    <SelectTrigger id="category">
                                        <SelectValue placeholder={t("stock.fields.categoryPlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                <span className="flex items-center gap-2">
                                                    <span>{cat.emoji}</span>
                                                    <span>{cat.name}</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.category_id && (
                            <p className="text-xs text-red-600">{t("stock.errors.categoryRequired")}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="zone">{t("stock.fields.zone")}</Label>
                        <Controller
                            control={control}
                            name="zone_id"
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={zonesLoading || zones.length === 0}
                                >
                                    <SelectTrigger id="zone">
                                        <SelectValue placeholder={t("stock.fields.zonePlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t("stock.fields.noZone")}</SelectItem>
                                        {zones.map((zone) => (
                                            <SelectItem key={zone.id} value={zone.id}>
                                                {zone.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">{t("stock.fields.status")}</Label>
                        <Controller
                            control={control}
                            name="status"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="status">
                                        <SelectValue placeholder={t("stock.fields.status")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STOCK_ITEM_STATUSES.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {t(`stock.status.${status}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="col-span-full space-y-2">
                        <Label htmlFor="description">{t("stock.fields.description")}</Label>
                        <Textarea
                            id="description"
                            {...register("description")}
                            placeholder={t("stock.fields.descriptionPlaceholder")}
                            rows={2}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Quantity */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("stock.sections.quantity")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="quantity">{t("stock.fields.quantity")} *</Label>
                        <Input
                            id="quantity"
                            type="number"
                            step="0.001"
                            inputMode="decimal"
                            {...register("quantity", { required: true })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="unit">{t("stock.fields.unit")} *</Label>
                        <Controller
                            control={control}
                            name="unit"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="unit">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEFAULT_UNITS.map((unit) => (
                                            <SelectItem key={unit} value={unit}>
                                                {unit}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="min_quantity">{t("stock.fields.minQuantity")}</Label>
                        <Input
                            id="min_quantity"
                            type="number"
                            step="0.001"
                            inputMode="decimal"
                            {...register("min_quantity")}
                            placeholder={t("stock.fields.minQuantityPlaceholder")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="max_quantity">{t("stock.fields.maxQuantity")}</Label>
                        <Input
                            id="max_quantity"
                            type="number"
                            step="0.001"
                            inputMode="decimal"
                            {...register("max_quantity")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="unit_price">{t("stock.fields.unitPrice")}</Label>
                        <Input
                            id="unit_price"
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            {...register("unit_price")}
                            placeholder="0.00"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Dates and sourcing */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("stock.sections.sourcing")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="supplier">{t("stock.fields.supplier")}</Label>
                        <Input
                            id="supplier"
                            {...register("supplier")}
                            placeholder={t("stock.fields.supplierPlaceholder")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="purchase_date">{t("stock.fields.purchaseDate")}</Label>
                        <Input id="purchase_date" type="date" {...register("purchase_date")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expiration_date">{t("stock.fields.expirationDate")}</Label>
                        <Input id="expiration_date" type="date" {...register("expiration_date")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sku">{t("stock.fields.sku")}</Label>
                        <Input id="sku" {...register("sku")} placeholder={t("stock.fields.skuPlaceholder")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="barcode">{t("stock.fields.barcode")}</Label>
                        <Input id="barcode" {...register("barcode")} placeholder={t("stock.fields.barcodePlaceholder")} />
                    </div>
                </CardContent>
            </Card>

            {/* Notes and tags */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("stock.sections.notes")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="notes">{t("stock.fields.notes")}</Label>
                        <Textarea
                            id="notes"
                            {...register("notes")}
                            placeholder={t("stock.fields.notesPlaceholder")}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tags">{t("stock.fields.tags")}</Label>
                        <Input
                            id="tags"
                            {...register("tags_input")}
                            placeholder={t("stock.fields.tagsPlaceholder")}
                        />
                        <p className="text-xs text-gray-500">{t("stock.fields.tagsHelper")}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t("common.saving") : mode === "create" ? t("stock.actions.create") : t("common.save")}
                </Button>
            </div>
        </form>
    );
}
