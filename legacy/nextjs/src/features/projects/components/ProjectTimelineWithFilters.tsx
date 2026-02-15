// Example usage in a project page component
// nextjs/src/features/projects/components/ProjectTimelineWithFilters.tsx
"use client";

import { useState } from "react";
import { INTERACTION_FILTERS, DEFAULT_PROJECT_FILTERS } from "@projects/lib/interactionFilters";
import ProjectTimeline from "./ProjectTimeline";
import InteractionFilterToggle from "./InteractionFilterToggle";
import type { Document, Interaction } from "@interactions/types";

interface ProjectTimelineWithFiltersProps {
    interactions: Interaction[];
    documentsByInteraction: Record<string, Document[]>;
    showFilterToggle?: boolean;
}

export default function ProjectTimelineWithFilters({
    interactions,
    documentsByInteraction,
    showFilterToggle = true
}: ProjectTimelineWithFiltersProps) {
    const [activeFilters, setActiveFilters] = useState<string[]>(DEFAULT_PROJECT_FILTERS);

    return (
        <div className="space-y-4">
            {showFilterToggle && (
                <div className="flex justify-end">
                    <InteractionFilterToggle
                        activeFilters={activeFilters}
                        onFiltersChange={setActiveFilters}
                    />
                </div>
            )}

            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={documentsByInteraction}
                filterKeys={activeFilters}
            />
        </div>
    );
}

// Export the available filters for other components to use
export { INTERACTION_FILTERS } from "@projects/lib/interactionFilters";