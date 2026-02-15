"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import InteractionList from "@/features/interactions/components/InteractionList";

import type { Interaction } from "@interactions/types";

type Props = {
    title: string;
    subtitle?: string;
    interactions: Interaction[];
    documentCounts: Record<string, number>;
    loading: boolean;
    error?: string | null;
    moreHref?: string;
    locale?: string;
    t: (key: string, args?: Record<string, unknown>) => string;
};

export default function EntityInteractionsCard({
    title,
    subtitle,
    interactions,
    documentCounts,
    loading,
    error,
    moreHref,
    locale,
    t,
}: Props) {
    return (
        <Card className="border border-border/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                    {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
                </div>
                {interactions.length > 0 && !loading && moreHref ? (
                    <Button asChild variant="outline" size="sm">
                        <Link href={moreHref}>{t("contacts.viewAllInteractions")}</Link>
                    </Button>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {t("common.loading")}
                    </div>
                ) : error ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                ) : interactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("contacts.latestInteractionsEmpty")}</p>
                ) : (
                    <InteractionList interactions={interactions} documentCounts={documentCounts} t={t} locale={locale} />
                )}
            </CardContent>
        </Card>
    );
}
