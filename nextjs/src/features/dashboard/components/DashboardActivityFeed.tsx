"use client";

import Link from "next/link";
import { Calendar, Folder, MessageCircle, Clock, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/I18nProvider";

import type { DashboardInteraction } from "@dashboard/types";

type DashboardActivityFeedProps = {
  interactions: DashboardInteraction[];
  loading?: boolean;
  householdName?: string | null;
};

const formatDateTime = (value: string, locale: string) => {
  try {
    const date = new Date(value);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInMs / (1000 * 60));
      if (locale === 'fr') {
        return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
      } else {
        return minutes <= 1 ? "just now" : `${minutes} min ago`;
      }
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      if (locale === 'fr') {
        return `il y a ${hours}h`;
      } else {
        return `${hours}h ago`;
      }
    } else if (diffInDays < 7) {
      const days = Math.floor(diffInDays);
      if (locale === 'fr') {
        return `il y a ${days}j`;
      } else {
        return `${days}d ago`;
      }
    } else {
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
  } catch {
    return value;
  }
};

const getInteractionIcon = (type: string) => {
  switch (type) {
    case "todo":
      return MessageCircle;
    case "quote":
      return Calendar;
    case "note":
    default:
      return MessageCircle;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "todo":
      return "bg-green-50 text-green-700 border-green-200";
    case "quote":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "note":
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
};

export default function DashboardActivityFeed({ interactions, loading = false, householdName }: DashboardActivityFeedProps) {
  const { locale, t } = useI18n();

  return (
    <Card aria-labelledby="dashboard-activity" className="h-fit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-600" />
          <CardTitle id="dashboard-activity" className="text-lg font-semibold text-slate-900">
            {t("dashboard.sections.activity")}
          </CardTitle>
        </div>
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
              <div key={index} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : interactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              {t("dashboard.activity.empty")}
            </p>
            <Link href="/app/interactions/new">
              <Button size="sm">
                {t("dashboard.activity.createFirst")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4" aria-live="polite">
            {interactions.map((interaction) => {
              const Icon = getInteractionIcon(interaction.type);
              const typeColor = getTypeColor(interaction.type);
              const timeLabel = formatDateTime(interaction.occurred_at ?? interaction.created_at, locale);

              return (
                <div key={interaction.id} className="flex gap-3 group">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${typeColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/app/interactions/${interaction.id}`}
                        className="font-medium text-sm text-foreground hover:text-primary-600 line-clamp-2 group-hover:text-primary-600 transition-colors"
                      >
                        {interaction.subject || t("dashboard.activity.untitled")}
                      </Link>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeLabel}
                      </span>
                    </div>
                    {interaction.content && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {interaction.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${typeColor}`}>
                        {t(`interactionstypes.${interaction.type}`)}
                      </Badge>
                      {interaction.project && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                          <Folder className="h-3 w-3 mr-1" />
                          {interaction.project.title}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Link href="/app/interactions" aria-label={t("dashboard.actions.viewInteractions")}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            {t("dashboard.actions.viewInteractions")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
