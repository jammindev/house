// nextjs/src/features/interactions/components/edit/InteractionEditFactory.tsx
"use client";

import TaskForm from "../forms/TaskForm";
import QuoteForm from "../forms/QuoteForm";
import NoteForm from "../forms/NoteForm";
import type { Interaction, InteractionStatus, ZoneOption } from "@interactions/types";

interface InteractionEditFactoryProps {
    interaction: Interaction;
    zones: ZoneOption[];
    zonesLoading?: boolean;
    onUpdated?: (interactionId: string) => void;
    redirectOnSuccess?: boolean;
}

export default function InteractionEditFactory({
    interaction,
    zones,
    zonesLoading = false,
    onUpdated,
    redirectOnSuccess = true,
}: InteractionEditFactoryProps) {
    const defaultValues = {
        status: (interaction.status as InteractionStatus) || ("" as const),
        occurredAt: interaction.occurred_at ? new Date(interaction.occurred_at).toISOString().slice(0, 16) : undefined,
        projectId: interaction.project_id || null,
    };

    switch (interaction.type) {
        case "todo":
            return (
                <TaskForm
                    zones={zones}
                    zonesLoading={zonesLoading}
                    onCreated={onUpdated}
                    defaultValues={defaultValues}
                    redirectOnSuccess={redirectOnSuccess}
                />
            );
        case "quote":
            return (
                <QuoteForm
                    onCreated={onUpdated}
                    defaultValues={defaultValues}
                    redirectOnSuccess={redirectOnSuccess}
                />
            );
        default:
            return (
                <NoteForm
                    zones={zones}
                    zonesLoading={zonesLoading}
                    onCreated={onUpdated}
                    defaultValues={defaultValues}
                    redirectOnSuccess={redirectOnSuccess}
                />
            );
    }
}