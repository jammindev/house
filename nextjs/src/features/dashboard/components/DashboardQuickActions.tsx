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
  FolderOpen,
  CreditCard,
  MapPin,
  MessageCircle,
  PenTool,
  Plus,
  ArrowRight,
  Upload
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import HorizontalScrollContainer from "@/components/ui/HorizontalScrollContainer";
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
  isNavigation?: boolean;
};

const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    key: "note",
    type: "note",
    status: "",
    labelKey: "dashboard.quickActions.addNote",
    descriptionKey: "dashboard.quickActions.addNoteDesc",
    icon: FileText,
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
  },
  {
    key: "todo",
    type: "todo",
    status: "pending",
    labelKey: "dashboard.quickActions.addTask",
    descriptionKey: "dashboard.quickActions.addTaskDesc",
    icon: CheckSquare,
    color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
  },
  {
    key: "expense",
    type: "expense",
    status: "",
    labelKey: "dashboard.quickActions.addExpense",
    descriptionKey: "dashboard.quickActions.addExpenseDesc",
    icon: CreditCard,
    color: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
  },
  {
    key: "quote",
    type: "quote",
    status: "",
    labelKey: "dashboard.quickActions.addQuote",
    descriptionKey: "dashboard.quickActions.addQuoteDesc",
    icon: Calculator,
    color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
  },
  {
    key: "call",
    type: "call",
    status: "",
    labelKey: "dashboard.quickActions.addCall",
    descriptionKey: "dashboard.quickActions.addCallDesc",
    icon: Phone,
    color: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
  },
  {
    key: "meeting",
    type: "meeting",
    status: "",
    labelKey: "dashboard.quickActions.addMeeting",
    descriptionKey: "dashboard.quickActions.addMeetingDesc",
    icon: Users,
    color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
  },
  {
    key: "visit",
    type: "visit",
    status: "",
    labelKey: "dashboard.quickActions.addVisit",
    descriptionKey: "dashboard.quickActions.addVisitDesc",
    icon: MapPin,
    color: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
  },
  {
    key: "message",
    type: "message",
    status: "",
    labelKey: "dashboard.quickActions.addMessage",
    descriptionKey: "dashboard.quickActions.addMessageDesc",
    icon: MessageCircle,
    color: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-200"
  },
  {
    key: "document",
    type: "document",
    status: "",
    labelKey: "dashboard.quickActions.addDocument",
    descriptionKey: "dashboard.quickActions.addDocumentDesc",
    icon: Upload,
    color: "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
  }
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

      const params = new URLSearchParams();
      params.set("type", config.type);
      if (config.status) {
        params.set("status", config.status);
      }
      router.push(`/app/interactions/new?${params.toString()}`);
    },
    [router]
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-foreground">{t("dashboard.quickActions.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground hidden sm:block">{t("dashboard.quickActions.subtitle")}</p>

      <HorizontalScrollContainer className="py-1" itemWidth="w-40" desktopColumns={3}>
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.key}
              className="transition-all duration-200 hover:shadow-md cursor-pointer group hover:scale-[1.02] border shadow-sm active:scale-95 active:shadow-lg touch-manipulation"
              onClick={() => handleInteractionClick(action)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <div className={`p-2 sm:p-2.5 rounded-lg transition-colors border ${action.color} shrink-0`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h3 className="font-medium text-xs sm:text-sm text-foreground group-hover:text-primary-600 transition-colors leading-tight">
                      {t(action.labelKey)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 hidden sm:block">
                      {t(action.descriptionKey)}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary-600 transition-all opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 hidden sm:block" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </HorizontalScrollContainer>

      {/* Indicateur mobile pour montrer que les cartes sont cliquables */}
      <p className="text-xs text-muted-foreground text-center sm:hidden opacity-75">
        {t("dashboard.quickActions.tapToCreate")}
      </p>
    </section>
  );
}
