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
        setTimeout(() => {
            router.refresh();
        }, 200);
        return;
    }, [router]);
    return (<Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleBack}
    >
        <ArrowLeft className="h-5 w-5" />
        <span className="sr-only">{t("common.back")}</span>
    </Button>)
}