// nextjs/src/features/stock/components/StockTabSheet.tsx
"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

type TabKey = "items" | "categories";

interface StockTabSheetProps {
    currentTab: TabKey;
    onSelect: (tab: TabKey) => void;
    className?: string;
}

const STOCK_TABS: readonly TabKey[] = ["items", "categories"] as const;

export default function StockTabSheet({
    currentTab,
    onSelect,
    className,
}: StockTabSheetProps) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);

    const handleTabSelect = (tab: TabKey) => {
        onSelect(tab);
        setIsOpen(false);
    };

    const trigger = (
        <Button
            variant="outline"
            className={cn(
                "w-full justify-between gap-2 h-12 px-4 bg-white border-slate-200 text-slate-900 hover:bg-slate-50",
                className
            )}
        >
            <span className="font-medium">{t(`stock.tabs.${currentTab}`)}</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
        </Button>
    );

    return (
        <SheetDialog
            trigger={trigger}
            title={t("stock.selectTab")}
            closeLabel={t("common.close")}
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <div className="flex flex-col gap-2">
                {STOCK_TABS.map((tab) => {
                    const isActive = tab === currentTab;

                    return (
                        <button
                            key={tab}
                            type="button"
                            disabled={isActive}
                            onClick={() => handleTabSelect(tab)}
                            className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                                isActive
                                    ? "border-slate-200 font-semibold"
                                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <span className="font-medium">{t(`stock.tabs.${tab}`)}</span>
                            {isActive ? <Check className="h-4 w-4 text-primary-600" /> : null}
                        </button>
                    );
                })}
            </div>
        </SheetDialog>
    );
}