"use client";

import Link from "next/link";
import { Calendar, Folder, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";

import type { DashboardInteraction } from "@dashboard/types";

type DashboardActivityFeedProps = {
  interactions: DashboardInteraction[];
  loading?: boolean;
  householdName?: string | null;
};

const formatDateTime = (value: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function DashboardActivityFeed({ interactions, loading = false, householdName }: DashboardActivityFeedProps) {
  const { locale, t } = useI18n();

  return (
    <Card aria-labelledby="dashboard-activity">
      <CardHeader>
        <CardTitle id="dashboard-activity" className="text-lg font-semibold text-slate-900">
          {t("dashboard.activity.title")}
        </CardTitle>
        <CardDescription>
          {householdName
            ? t("dashboard.activity.subtitle", { household: householdName })
            : t("dashboard.activity.subtitleFallback")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div data-testid="activity-loading" className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 w-full animate-pulse rounded-lg bg-slate-200" />
            ))}
          </div>
        ) : interactions.length === 0 ? (
          <p className="text-sm text-slate-600" role="status">
            {t("dashboard.activity.empty")}
          </p>
        ) : (
          <ol className="space-y-3" aria-live="polite">
            {interactions.map((interaction) => (
              <li key={interaction.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/app/interactions/${interaction.id}`}
                      className="font-semibold text-primary-600 hover:text-primary-700"
                    >
                      {interaction.subject || t("dashboard.activity.untitled")}
                    </Link>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" aria-hidden />
                      {formatDateTime(interaction.occurred_at ?? interaction.created_at, locale)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600">{interaction.content}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      {t(`interactionstypes.${interaction.type}`)}
                    </span>
                    {interaction.project ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                        <Folder className="h-3.5 w-3.5" aria-hidden />
                        {interaction.project.title}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Link href="/app/interactions" aria-label={t("dashboard.activity.viewAll")}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            {t("dashboard.activity.viewAll")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
