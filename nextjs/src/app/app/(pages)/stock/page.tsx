// nextjs/src/app/app/(pages)/stock/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Plus, Settings } from "lucide-react";

import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import StockList from "@/features/stock/components/StockList";
import StockCategoryList from "@/features/stock/components/StockCategoryList";
import { useStockItems } from "@/features/stock/hooks/useStockItems";
import { useStockCategories } from "@/features/stock/hooks/useStockCategories";
import { STOCK_ITEM_STATUSES } from "@/features/stock/constants";
import type { StockItemStatus } from "@/features/stock/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useZones } from "@zones/hooks/useZones";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

export default function StockPage() {
    const { t } = useI18n();
    const { items, filters, setFilters, loading, error } = useStockItems();
    const {
        categories,
        loading: categoriesLoading,
        createCategory,
        updateCategory,
        deleteCategory,
    } = useStockCategories();
    const { zones } = useZones();
    const [activeTab, setActiveTab] = useState("items");

    const actions = useMemo(
        () => [
            {
                icon: Plus,
                href: "/app/stock/new",
                variant: "default" as const,
            },
        ],
        []
    );

    const handleStatusChange = (value: string) => {
        if (value === "all") {
            setFilters((prev) => ({ ...prev, statuses: [] }));
        } else {
            setFilters((prev) => ({ ...prev, statuses: [value as StockItemStatus] }));
        }
    };

    const toolbar = (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
                <TabsTrigger value="items">{t("stock.tabs.items")}</TabsTrigger>
                <TabsTrigger value="categories">{t("stock.tabs.categories")}</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="mt-0">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Input
                        placeholder={t("stock.filters.search")}
                        value={filters.search ?? ""}
                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <Select
                        value={filters.categoryId ?? "all"}
                        onValueChange={(value) =>
                            setFilters((prev) => ({ ...prev, categoryId: value === "all" ? null : value }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("stock.filters.category")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("stock.filters.anyCategory")}</SelectItem>
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
                    <Select value={filters.statuses?.[0] ?? "all"} onValueChange={handleStatusChange}>
                        <SelectTrigger>
                            <SelectValue placeholder={t("stock.filters.status")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("stock.filters.anyStatus")}</SelectItem>
                            {STOCK_ITEM_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {t(`stock.status.${status}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.zoneId ?? "all"}
                        onValueChange={(value) =>
                            setFilters((prev) => ({ ...prev, zoneId: value === "all" ? null : value }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("stock.filters.zone")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("stock.filters.anyZone")}</SelectItem>
                            {zones.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                    {zone.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </TabsContent>

            <TabsContent value="categories" className="mt-0">
                {/* Category list is shown below */}
            </TabsContent>
        </Tabs>
    );

    const emptyState = (
        <EmptyState
            title={t("stock.emptyTitle")}
            description={t("stock.emptyDescription")}
            action={
                categories.length > 0 ? (
                    <Button asChild>
                        <LinkWithOverlay href="/app/stock/new">{t("stock.actions.create")}</LinkWithOverlay>
                    </Button>
                ) : (
                    <Button onClick={() => setActiveTab("categories")}>
                        {t("stock.actions.createCategoryFirst")}
                    </Button>
                )
            }
        />
    );

    return (
        <ListPageLayout
            title={t("stock.title")}
            subtitle={t("stock.subtitle")}
            hideBackButton
            actions={actions}
            toolbar={toolbar}
            loading={loading && activeTab === "items"}
            error={error || null}
            errorTitle={t("stock.loadFailed")}
            isEmpty={activeTab === "items" && !loading && items.length === 0}
            emptyState={emptyState}
        >
            {activeTab === "items" ? (
                <StockList items={items} t={t} />
            ) : (
                <StockCategoryList
                    categories={categories}
                    onCreateCategory={createCategory}
                    onUpdateCategory={updateCategory}
                    onDeleteCategory={deleteCategory}
                />
            )}
        </ListPageLayout>
    );
}
