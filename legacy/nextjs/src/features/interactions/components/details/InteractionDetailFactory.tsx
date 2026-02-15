// nextjs/src/features/interactions/components/details/InteractionDetailFactory.tsx
"use client";

import TaskDetail from "./TaskDetail";
import QuoteDetail from "./QuoteDetail";
import BaseInteractionDetail from "./BaseInteractionDetail";
import type { Interaction } from "@interactions/types";

interface InteractionDetailFactoryProps {
    interaction: Interaction;
}

export default function InteractionDetailFactory({ interaction }: InteractionDetailFactoryProps) {
    switch (interaction.type) {
        case "todo":
            return <TaskDetail interaction={interaction} />;
        case "quote":
            return <QuoteDetail interaction={interaction} />;
        default:
            return <BaseInteractionDetail interaction={interaction} />;
    }
}