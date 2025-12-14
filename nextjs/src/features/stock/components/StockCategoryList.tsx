// nextjs/src/features/stock/components/StockCategoryList.tsx
"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import type { StockCategory } from "../types";
import StockCategoryForm from "./StockCategoryForm";

type Props = {
    categories: StockCategory[];
    onCreateCategory: (data: { name: string; color: string; emoji: string; description: string }) => Promise<unknown>;
    onUpdateCategory: (id: string, data: Partial<StockCategory>) => Promise<void>;
    onDeleteCategory: (id: string) => Promise<void>;
};

export default function StockCategoryList({
    categories,
    onCreateCategory,
    onUpdateCategory,
    onDeleteCategory,
}: Props) {
    const { t } = useI18n();
    const { show } = useToast();
    const [formOpen, setFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleCreate = async (data: { name: string; color: string; emoji: string; description: string }) => {
        await onCreateCategory(data);
        show({ title: t("stock.categories.createSuccess"), variant: "default" });
    };

    const handleUpdate = async (data: { name: string; color: string; emoji: string; description: string }) => {
        if (!editingCategory) return;
        await onUpdateCategory(editingCategory.id, data);
        setEditingCategory(null);
        show({ title: t("stock.categories.updateSuccess"), variant: "default" });
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await onDeleteCategory(id);
            show({ title: t("stock.categories.deleteSuccess"), variant: "default" });
        } catch {
            show({ title: t("stock.categories.deleteFailed"), variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                    {t("stock.categories.title")}
                </h2>
                <Button size="sm" onClick={() => setFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("stock.categories.add")}
                </Button>
            </div>

            {categories.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-gray-500">{t("stock.categories.empty")}</p>
                        <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
                            {t("stock.categories.createFirst")}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat) => (
                        <Card key={cat.id} className="relative overflow-hidden">
                            <div
                                className="absolute left-0 top-0 h-full w-1"
                                style={{ backgroundColor: cat.color }}
                            />
                            <CardContent className="flex items-center justify-between gap-3 py-4 pl-5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                                        style={{ backgroundColor: `${cat.color}20` }}
                                    >
                                        {cat.emoji}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{cat.name}</p>
                                        {cat.description && (
                                            <p className="text-xs text-gray-500 line-clamp-1">{cat.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditingCategory(cat)}
                                        aria-label={t("common.edit")}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t("common.delete")}
                                            >
                                                <Trash2 className="h-4 w-4 text-rose-500" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t("stock.categories.deleteTitle")}</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t("stock.categories.deleteDescription", { name: cat.name })}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDelete(cat.id)}
                                                    disabled={deletingId === cat.id}
                                                >
                                                    {deletingId === cat.id ? t("common.deleting") : t("common.delete")}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create dialog */}
            <StockCategoryForm
                open={formOpen}
                onOpenChange={setFormOpen}
                onSave={handleCreate}
            />

            {/* Edit dialog */}
            <StockCategoryForm
                open={!!editingCategory}
                onOpenChange={(open) => !open && setEditingCategory(null)}
                category={editingCategory}
                onSave={handleUpdate}
            />
        </div>
    );
}
