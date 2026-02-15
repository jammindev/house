// nextjs/src/app/app/(pages)/stock/[id]/page.tsx
"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import StockDetailView from "@/features/stock/components/StockDetailView";
import { useStockItem } from "@/features/stock/hooks/useStockItem";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

export default function StockDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { t, locale } = useI18n();
    const { show } = useToast();
    const { item, loading, error, deleteItem, adjustQuantity } = useStockItem(id);

    const layoutActions = useMemo(() => {
        if (!item) return [];
        return [
            {
                icon: Pencil,
                href: `/app/stock/${item.id}/edit`,
            } as const,
        ];
    }, [item]);

    const handleDelete = async () => {
        try {
            await deleteItem();
            show({ title: t("stock.deleteSuccess"), variant: "default" });
            router.push("/app/stock");
        } catch {
            show({ title: t("stock.deleteFailed"), variant: "destructive" });
        }
    };

    const handleQuantityAdjust = async (delta: number) => {
        try {
            await adjustQuantity(delta);
            show({ title: t("stock.quantityUpdated"), variant: "default" });
        } catch {
            show({ title: t("stock.quantityUpdateFailed"), variant: "destructive" });
        }
    };

    const isNotFound = !loading && (!id || !item);
    const context = item?.category?.name;

    return (
        <DetailPageLayout
            context={context}
            actions={layoutActions}
            loading={loading}
            error={error || null}
            errorTitle={t("stock.loadFailed")}
            isNotFound={isNotFound}
            notFoundState={
                <EmptyState
                    title={t("stock.notFound")}
                    description={t("stock.notFoundDescription")}
                    action={
                        <Button asChild variant="outline">
                            <LinkWithOverlay href="/app/stock">{t("stock.actions.backToList")}</LinkWithOverlay>
                        </Button>
                    }
                />
            }
        >
            {item ? (
                <StockDetailView
                    item={item}
                    onDeleted={handleDelete}
                    onQuantityAdjusted={handleQuantityAdjust}
                    t={t}
                    locale={locale}
                />
            ) : null}
        </DetailPageLayout>
    );
}
