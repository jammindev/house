// nextjs/src/features/dashboard/components/DashboardQuickActions.tsx
"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import ActionsGrid from "@/components/ui/actions-grid";
import InteractionAttachmentImport from "@/features/interactions/components/InteractionAttachmentImport";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  getInteractionTypesByCategory,
} from "@interactions/constants/interactionTypes";
import type { InteractionType } from "@interactions/types";

const QUICK_ACTION_TYPES: InteractionType[] = [
  "note",
  "expense",
  "quote",
  "call",
  "meeting",
  "visit",
  "message",
  "document",
  "maintenance",
  "repair",
  "installation",
  "inspection",
  "warranty",
  "issue",
  "upgrade",
  "replacement",
  "disposal",
  "signature",
  "other",
];

export default function DashboardQuickActions() {
  const { t } = useI18n();

  // Récupérer toutes les configs groupées par catégorie
  const typesByCategory = getInteractionTypesByCategory();
  const interactionActions = Object.values(typesByCategory)
    .flat()
    .filter((config) => QUICK_ACTION_TYPES.includes(config.type))
    .map((config) => ({
      type: config.type,
    }));

  return (
    <SheetDialog
      trigger={
        <Button size="icon" className="gap-2">
          <Plus className="h-4 w-4" />
        </Button>
      }
      title={t("dashboard.quickActions.title")}
      description={t("dashboard.quickActions.subtitle")}
      closeLabel={t("common.close")}
      contentClassName="pb-4"
    >
      {({ close }) => (
        <div className="space-y-6">
          <ActionsGrid
            interactionActions={interactionActions}
            showCategoryHeaders={true}
            responsive={true}
          />

          <div className="pt-4 border-t">
            <SheetDialog
              trigger={
                <Button variant="outline" className="w-full" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("dashboard.quickActions.importFromFiles")}
                </Button>
              }
              title={t("dashboard.quickActions.importFromFiles")}
              description={t("dashboard.quickActions.importFromFilesDescription")}
            >
              <InteractionAttachmentImport />
            </SheetDialog>
          </div>
        </div>
      )}
    </SheetDialog>
  );
}
