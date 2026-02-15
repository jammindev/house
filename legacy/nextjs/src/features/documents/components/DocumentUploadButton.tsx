// nextjs/src/features/documents/components/DocumentUploadButton.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { DocumentUploadSection } from "./DocumentUploadSection";

type DocumentUploadButtonProps = {
    onUploadSuccess?: (uploadedIds: string[]) => void;
};

export function DocumentUploadButton({ onUploadSuccess }: DocumentUploadButtonProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);

    const handleUploadSuccess = (uploadedIds: string[]) => {
        onUploadSuccess?.(uploadedIds);
        setOpen(false);
    };

    return (
        <SheetDialog
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                </Button>
            }
            title={t("documents.upload.title")}
            description={t("documents.upload.subtitle")}
            closeLabel={t("common.close")}
            contentClassName="pb-4"
        >
            <DocumentUploadSection
                onUploadSuccess={handleUploadSuccess}
                defaultCollapsed={false}
            />
        </SheetDialog>
    );
}