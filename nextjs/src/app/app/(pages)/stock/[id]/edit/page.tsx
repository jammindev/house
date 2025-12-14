// nextjs/src/app/app/(pages)/stock/[id]/edit/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import StockItemForm from "@/features/stock/components/StockItemForm";
import EmptyState from "@shared/components/EmptyState";
import { useStockItem } from "@/features/stock/hooks/useStockItem";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

export default function EditStockItemPage() {
    const { id } = useParams<{ id: string }>();
    const { t } = useI18n();
    const router = useRouter();
    const { item, loading, error } = useStockItem(id);

    if (loading) {
        return (
            <ResourcePageShell title={t("stock.editTitle")}>
                <p className="text-sm text-gray-500">{t("common.loading")}</p>
            </ResourcePageShell>
        );
    }

    if (!item) {
        return (
            <ResourcePageShell title={t("stock.editTitle")} subtitle={t("stock.editSubtitle")}>
                {error ? (
                    <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : (
                    <EmptyState
                        title={t("stock.notFound")}
                        description={t("stock.notFoundDescription")}
                        action={
                            <Button asChild variant="outline">
                                <LinkWithOverlay href="/app/stock">{t("stock.actions.backToList")}</LinkWithOverlay>
                            </Button>
                        }
                    />
                )}
            </ResourcePageShell>
        );
    }

    return (
        <ResourcePageShell
            title={t("stock.editTitle")}
            subtitle={t("stock.editSubtitle")}
            bodyClassName="mt-4"
        >
            <StockItemForm
                item={item}
                mode="edit"
                onSaved={(nextId) => {
                    router.push(`/app/stock/${nextId}`);
                }}
            />
        </ResourcePageShell>
    );
}
