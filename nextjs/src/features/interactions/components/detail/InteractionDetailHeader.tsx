// nextjs/src/features/interactions/components/detail/InteractionDetailHeader.tsx
"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionAttachmentImport from "@interactions/components/InteractionAttachmentImport";
import type { Interaction } from "@interactions/types";
import BackButton from "@/components/BackButton";

type InteractionDetailHeaderProps = {
  interaction: Interaction;
  updatedAt: string;
  onReload: () => void;
  onEdit: () => void;
};

export default function InteractionDetailHeader({
  interaction,
  updatedAt,
  onReload,
  onEdit,
}: InteractionDetailHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <BackButton />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
              {interaction.subject}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("interactiondetail.updatedAt")} {updatedAt}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">{t("interactionsedit.open")}</span>
          </Button>
          <InteractionAttachmentImport interactionId={interaction.id} onUploaded={onReload} />
        </div>
      </div>
    </header>
  );
}
