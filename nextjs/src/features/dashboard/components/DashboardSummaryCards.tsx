"use client";

import Link from "next/link";
import { ArrowRight, FileText, Layers, PlusCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";

import type { DashboardSummaryMetrics } from "@dashboard/types";

type DashboardSummaryCardsProps = {
  summary: DashboardSummaryMetrics | null;
  loading?: boolean;
};

const SUMMARY_ITEMS = [
  {
    key: "interactions" as const,
    icon: PlusCircle,
    primaryCta: "/app/interactions/new",
    secondaryCta: "/app/interactions",
    primaryLabelKey: "dashboard.actions.logInteraction",
    secondaryLabelKey: "dashboard.actions.viewInteractions",
    descriptionKey: "dashboard.summary.interactionsDescription",
  },
  {
    key: "zones" as const,
    icon: Layers,
    primaryCta: "/app/zones",
    secondaryCta: null,
    primaryLabelKey: "dashboard.actions.manageZones",
    secondaryLabelKey: null,
    descriptionKey: "dashboard.summary.zonesDescription",
  },
  {
    key: "contacts" as const,
    icon: Users,
    primaryCta: "/app/contacts",
    secondaryCta: "/app/households",
    primaryLabelKey: "dashboard.actions.viewContacts",
    secondaryLabelKey: "dashboard.actions.inviteMember",
    descriptionKey: "dashboard.summary.contactsDescription",
  },
  {
    key: "documents" as const,
    icon: FileText,
    primaryCta: "/app/documents",
    secondaryCta: null,
    primaryLabelKey: "dashboard.actions.browseDocuments",
    secondaryLabelKey: null,
    descriptionKey: "dashboard.summary.documentsDescription",
  },
];

export default function DashboardSummaryCards({ summary, loading = false }: DashboardSummaryCardsProps) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="dashboard-summary" className="space-y-4">
      <div className="flex flex-col gap-2">
        <h2 id="dashboard-summary" className="text-lg font-semibold text-slate-900">
          {t("dashboard.summaryTitle")}
        </h2>
        <p className="text-sm text-slate-600">{t("dashboard.summarySubtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_ITEMS.map((item) => {
          const Icon = item.icon;
          const value = summary ? summary[item.key] : "—";
          return (
            <Card key={item.key} aria-busy={loading} aria-live="polite">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {t(`dashboard.${item.key}`)}
                  </CardTitle>
                  <Icon className="h-5 w-5 text-primary-500" aria-hidden />
                </div>
                <CardDescription>{t(item.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div data-testid={`summary-skeleton-${item.key}`} className="h-9 w-20 animate-pulse rounded bg-slate-200" />
                ) : (
                  <p className="text-3xl font-semibold text-slate-900">{value}</p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Link href={item.primaryCta} aria-label={t(item.primaryLabelKey)}>
                  <Button size="sm" className="flex items-center gap-1">
                    {item.key === "interactions" ? <PlusCircle className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />} 
                    {t(item.primaryLabelKey)}
                  </Button>
                </Link>
                {item.secondaryCta ? (
                  <Link href={item.secondaryCta} aria-label={t(item.secondaryLabelKey!)}>
                    <Button size="sm" variant="secondary" className="flex items-center gap-1">
                      <ArrowRight className="h-4 w-4" aria-hidden />
                      {t(item.secondaryLabelKey!)}
                    </Button>
                  </Link>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
