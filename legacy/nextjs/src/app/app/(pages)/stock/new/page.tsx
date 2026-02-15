// nextjs/src/app/app/(pages)/stock/new/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import StockItemForm from "@/features/stock/components/StockItemForm";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function NewStockItemPage() {
    const { t } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const defaultCategoryId = searchParams.get("category") ?? undefined;

    return (
        <ResourcePageShell
            title={t("stock.newTitle")}
            subtitle={t("stock.newSubtitle")}
            bodyClassName="mt-4"
        >
            <StockItemForm
                mode="create"
                defaultCategoryId={defaultCategoryId}
                onSaved={(id) => {
                    router.push(`/app/stock/${id}`);
                }}
            />
        </ResourcePageShell>
    );
}
