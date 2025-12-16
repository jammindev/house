"use client";

import { ArrowRight, CalendarClock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import InteractionItem from "@interactions/components/InteractionItem";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useUpcomingInteractions } from "../hooks/useUpcomingInteractions";

export default function DashboardUpcomingInteractions() {
    const { selectedHouseholdId } = useGlobal();
    const { t } = useI18n();
    const { interactions, loading, error } = useUpcomingInteractions(selectedHouseholdId);

    return (
        <section className="space-y-2">
            <header className="flex gap-2 justify-between items-center">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    <h2 className="text-lg font-semibold text-foreground">
                        {t("dashboard.upcomingInteractions.title")}
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="sm" className="justify-start gap-1 text-primary-700">
                        <LinkWithOverlay href="/app/interactions">
                            {t("dashboard.upcomingInteractions.viewAll")}
                            <ArrowRight className="h-4 w-4" />
                        </LinkWithOverlay>
                    </Button>
                </div>
            </header>

            {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-32 rounded-2xl border border-slate-200 bg-slate-100/60 animate-pulse"
                        />
                    ))}
                </div>
            ) : interactions.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {interactions.map((interaction) => (
                        <InteractionItem
                            key={interaction.id}
                            interaction={interaction}
                            documentCount={interaction.documentCount}
                            t={t}
                            returnTo="/app/dashboard"
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {t("dashboard.upcomingInteractions.empty")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {t("dashboard.upcomingInteractions.hint")}
                    </p>
                    <Button asChild variant="secondary" size="sm" className="mt-4">
                        <LinkWithOverlay href="/app/interactions/new">
                            {t("dashboard.upcomingInteractions.create")}
                        </LinkWithOverlay>
                    </Button>
                </div>
            )}
        </section>
    );
}
