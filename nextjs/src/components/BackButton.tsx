// nextjs/src/components/BackButton.tsx
'use client';
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function BackButton() {
    const { t } = useI18n();
    const router = useRouter();

    const handleBack = useCallback(() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }
    }, [router]);
    return (<Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="w-fit gap-2 rounded-full border border-transparent px-3 text-sm font-medium text-muted-foreground hover:border-border/60 hover:bg-background"
    >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
    </Button>)
}