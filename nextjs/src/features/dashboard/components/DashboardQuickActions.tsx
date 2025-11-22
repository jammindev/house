// nextjs/src/features/dashboard/components/DashboardQuickActions.tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  CheckSquare,
  Calculator,
  Phone,
  Users,
  CreditCard,
  MapPin,
  MessageCircle,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import InteractionAttachmentImport from "@/features/interactions/components/InteractionAttachmentImport";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { InteractionStatus, InteractionType } from "@interactions/types";

type QuickActionConfig = {
  key: string;
  type?: InteractionType;
  status?: InteractionStatus | "";
  labelKey: string;
  descriptionKey: string;
  icon: typeof FileText;
  color: string;
  href?: string;
};

const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    key: "note",
    type: "note",
    status: "",
    labelKey: "dashboard.quickActions.addNote",
    descriptionKey: "dashboard.quickActions.addNoteDesc",
    icon: FileText,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "todo",
    type: "todo",
    status: "pending",
    labelKey: "dashboard.quickActions.addTask",
    descriptionKey: "dashboard.quickActions.addTaskDesc",
    icon: CheckSquare,
    color: "bg-green-50 text-green-700 border-green-200",
  },
  {
    key: "expense",
    type: "expense",
    status: "",
    labelKey: "dashboard.quickActions.addExpense",
    descriptionKey: "dashboard.quickActions.addExpenseDesc",
    icon: CreditCard,
    color: "bg-red-50 text-red-700 border-red-200",
  },
  {
    key: "quote",
    type: "quote",
    status: "",
    labelKey: "dashboard.quickActions.addQuote",
    descriptionKey: "dashboard.quickActions.addQuoteDesc",
    icon: Calculator,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    key: "call",
    type: "call",
    status: "",
    labelKey: "dashboard.quickActions.addCall",
    descriptionKey: "dashboard.quickActions.addCallDesc",
    icon: Phone,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    key: "meeting",
    type: "meeting",
    status: "",
    labelKey: "dashboard.quickActions.addMeeting",
    descriptionKey: "dashboard.quickActions.addMeetingDesc",
    icon: Users,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    key: "visit",
    type: "visit",
    status: "",
    labelKey: "dashboard.quickActions.addVisit",
    descriptionKey: "dashboard.quickActions.addVisitDesc",
    icon: MapPin,
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    key: "message",
    type: "message",
    status: "",
    labelKey: "dashboard.quickActions.addMessage",
    descriptionKey: "dashboard.quickActions.addMessageDesc",
    icon: MessageCircle,
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
];

export default function DashboardQuickActions() {
  const { t } = useI18n();
  const router = useRouter();

  const handleInteractionClick = useCallback(
    (config: QuickActionConfig) => {
      if (config.href) {
        router.push(config.href);
        return;
      }

      if (!config.type) return;

      const specializedTypes = ["note", "todo", "quote", "expense", "call", "visit"];
      const params = new URLSearchParams();

      if (config.status) {
        params.set("status", config.status);
      }

      const queryString = params.toString();

      if (specializedTypes.includes(config.type)) {
        const url = `/app/interactions/new/${config.type}${queryString ? `?${queryString}` : ""}`;
        router.push(url);
      } else {
        params.set("type", config.type);
        router.push(`/app/interactions/new?${params.toString()}`);
      }
    },
    [router],
  );

  return (
    <SheetDialog
      trigger={
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("dashboard.quickActions.triggerLabel")}</span>
        </Button>
      }
      title={t("dashboard.quickActions.title")}
      description={t("dashboard.quickActions.subtitle")}
      closeLabel={t("common.close")}
      contentClassName="pb-4"
    >
      {({ close }) => (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.key}
                  role="button"
                  tabIndex={0}
                  className="group cursor-pointer border shadow-sm transition-all duration-200 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary-600"
                  onClick={() => {
                    close();
                    handleInteractionClick(action);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      close();
                      handleInteractionClick(action);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md border ${action.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">{t(action.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">{t(action.descriptionKey)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("dashboard.quickActions.addDocument")}</p>
              <p className="text-xs text-muted-foreground">{t("dashboard.quickActions.addDocumentDesc")}</p>
            </div>
            <div className="self-start sm:self-auto">
              <InteractionAttachmentImport />
            </div>
          </div>
        </div>
      )}
    </SheetDialog>
  );
}
