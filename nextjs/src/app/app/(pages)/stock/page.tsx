// nextjs/src/app/app/(pages)/stock/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import StockList from "@/features/stock/components/StockList";
import StockCategoryList from "@/features/stock/components/StockCategoryList";
import StockTabSheet from "@/features/stock/components/StockTabSheet";
import { useStockItems } from "@/features/stock/hooks/useStockItems";
import { useStockCategories } from "@/features/stock/hooks/useStockCategories";
import { STOCK_ITEM_STATUSES } from "@/features/stock/constants";
import type { StockItemStatus } from "@/features/stock/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useZones } from "@zones/hooks/useZones";
import { useIsMobile } from "@documents/hooks/useIsMobile";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

type TabKey = "items" | "categories";

export default function StockPage() {
    const { t } = useI18n();
    const isMobile = useIsMobile();
    const { items, filters, setFilters, loading, error } = useStockItems();
    const {
        categories,
        loading: categoriesLoading,
        createCategory,
        updateCategory,
        deleteCategory,
    } = useStockCategories();
    const { zones } = useZones();
    const [activeTab, setActiveTab] = useState<TabKey>("items");

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

    const filtersToolbar = (
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
    );

    const toolbar = (
        <div className="space-y-4">
            {/* Tabs Navigation */}
            <div className={cn("flex flex-col rounded-lg", !isMobile && "bg-stone-50", isMobile && "space-y-2")}>
                {/* Mobile: TabSheet */}
                {isMobile ? (
                    <StockTabSheet
                        currentTab={activeTab}
                        onSelect={setActiveTab}
                    />
                ) : (
                    /* Desktop: Horizontal tabs */
                    <div className="border border-slate-200 bg-white overflow-x-scroll rounded-lg shadow-sm overflow-hidden">
                        <div className="flex border-b border-slate-200 bg-slate-50/30">
                            {(["items", "categories"] as const).map((tabKey) => (
                                <button
                                    key={tabKey}
                                    type="button"
                                    onClick={() => setActiveTab(tabKey)}
                                    className={cn(
                                        "flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap border-b-2 relative",
                                        activeTab === tabKey
                                            ? "border-primary-600 text-primary-700 font-semibold shadow-sm"
                                            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60"
                                    )}
                                >
                                    {t(`stock.tabs.${tabKey}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Filters - only show for items tab */}
            {activeTab === "items" && filtersToolbar}
        </div>
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