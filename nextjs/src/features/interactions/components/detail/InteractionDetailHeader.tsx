import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionAttachmentImport from "@interactions/components/InteractionAttachmentImport";
import type { Interaction } from "@interactions/types";

type InteractionDetailHeaderProps = {
  interaction: Interaction;
  typeLabel: string;
  statusLabel: string;
  occurredAt: string;
  onReload: () => void;
  onEdit: () => void;
};

export default function InteractionDetailHeader({
  interaction,
  typeLabel,
  statusLabel,
  occurredAt,
  onReload,
  onEdit,
}: InteractionDetailHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon">
            <Link href="/app/interactions">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{interaction.subject}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 uppercase tracking-wide">
                {typeLabel}
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500">{occurredAt}</div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          {t("interactionsedit.open")}
        </Button>
        <InteractionAttachmentImport interactionId={interaction.id} onUploaded={onReload} />
      </div>
    </header>
  );
}
