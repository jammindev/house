// nextjs/src/features/stock/components/StockCategoryForm.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { StockCategory } from "../types";
import { SUGGESTED_CATEGORY_COLORS, SUGGESTED_CATEGORY_EMOJIS } from "../constants";

type FormValues = {
    name: string;
    color: string;
    emoji: string;
    description: string;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category?: StockCategory | null;
    onSave: (data: FormValues) => Promise<void>;
};

export default function StockCategoryForm({ open, onOpenChange, category, onSave }: Props) {
    const { t } = useI18n();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
        reset,
    } = useForm<FormValues>({
        defaultValues: {
            name: category?.name ?? "",
            color: category?.color ?? "#6366f1",
            emoji: category?.emoji ?? "📦",
            description: category?.description ?? "",
        },
    });

    const selectedColor = watch("color");
    const selectedEmoji = watch("emoji");

    const onSubmit = async (data: FormValues) => {
        setError(null);
        setSaving(true);
        try {
            await onSave(data);
            reset();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.unexpectedError"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {category ? t("stock.categories.editTitle") : t("stock.categories.createTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {category ? t("stock.categories.editDescription") : t("stock.categories.createDescription")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">{t("stock.categories.name")} *</Label>
                        <Input
                            id="name"
                            {...register("name", { required: t("stock.categories.nameRequired") })}
                            placeholder={t("stock.categories.namePlaceholder")}
                        />
                        {errors.name && (
                            <p className="text-xs text-red-600">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Emoji picker */}
                    <div className="space-y-2">
                        <Label>{t("stock.categories.emoji")} *</Label>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-12 w-12 items-center justify-center rounded-lg border-2 text-2xl"
                                style={{ borderColor: selectedColor }}
                            >
                                {selectedEmoji}
                            </div>
                            <Input
                                {...register("emoji", { required: t("stock.categories.emojiRequired") })}
                                className="w-20"
                                maxLength={2}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_CATEGORY_EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setValue("emoji", emoji)}
                                    className={`rounded border p-1.5 text-lg transition hover:bg-gray-100 ${selectedEmoji === emoji ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                                        }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        {errors.emoji && (
                            <p className="text-xs text-red-600">{errors.emoji.message}</p>
                        )}
                    </div>

                    {/* Color picker */}
                    <div className="space-y-2">
                        <Label htmlFor="color">{t("stock.categories.color")} *</Label>
                        <div className="flex items-center gap-3">
                            <div
                                className="h-10 w-10 rounded-lg border"
                                style={{ backgroundColor: selectedColor }}
                            />
                            <Input
                                id="color"
                                type="text"
                                {...register("color", {
                                    required: t("stock.categories.colorRequired"),
                                    pattern: {
                                        value: /^#[0-9a-fA-F]{6}$/,
                                        message: t("stock.categories.colorInvalid"),
                                    },
                                })}
                                placeholder="#6366f1"
                                className="w-28"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_CATEGORY_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setValue("color", color)}
                                    className={`h-8 w-8 rounded-lg border-2 transition hover:scale-110 ${selectedColor === color ? "ring-2 ring-offset-2 ring-indigo-500" : ""
                                        }`}
                                    style={{ backgroundColor: color, borderColor: color }}
                                    aria-label={color}
                                />
                            ))}
                        </div>
                        {errors.color && (
                            <p className="text-xs text-red-600">{errors.color.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">{t("stock.categories.description")}</Label>
                        <Textarea
                            id="description"
                            {...register("description")}
                            placeholder={t("stock.categories.descriptionPlaceholder")}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? t("common.saving") : t("common.save")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
