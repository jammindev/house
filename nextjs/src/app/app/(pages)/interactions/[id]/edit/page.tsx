// nextjs/src/app/app/(pages)/interactions/[id]/edit/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useInteraction } from "@interactions/hooks/useInteraction";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Notebook } from "lucide-react";
import InteractionEditForm from "@interactions/components/InteractionEditForm";

export default function EditInteractionPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { t } = useI18n();
    const { interaction, loading, error } = useInteraction(id);

    const isNotFound = !loading && (!id || !interaction);

    if (loading) {
        return (
            <ResourcePageShell
                title={t("interactionsedit.title")}
                subtitle=""
                hideBackButton={false}
                bodyClassName="gap-4"
            >
                <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">{t("common.loading")}</div>
                </div>
            </ResourcePageShell>
        );
    }

    if (error) {
        return (
            <ResourcePageShell
                title={t("interactionsedit.title")}
                subtitle=""
                hideBackButton={false}
                bodyClassName="gap-4"
            >
                <Alert variant="destructive">
                    <AlertTitle>{t("interactionsloadFailed")}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </ResourcePageShell>
        );
    }

    if (isNotFound) {
        return (
            <ResourcePageShell
                title={t("interactionsedit.title")}
                subtitle=""
                hideBackButton={false}
                bodyClassName="gap-4"
            >
                <EmptyState
                    icon={Notebook}
                    title={t("interactionsnotFound")}
                    description={t("interactionsnewEntryIntro")}
                    action={
                        <Button asChild variant="outline">
                            <Link href="/app/interactions">{t("interactionstitle")}</Link>
                        </Button>
                    }
                />
            </ResourcePageShell>
        );
    }

    const handleSaved = () => {
        router.push(`/app/interactions/${interaction!.id}`);
    };

    return (
        <ResourcePageShell
            title={t("interactionsedit.title")}
            subtitle={interaction?.subject}
            hideBackButton={false}
            bodyClassName="gap-4"
        >
            <InteractionEditForm interaction={interaction!} onSaved={handleSaved} />
        </ResourcePageShell>
    );
}