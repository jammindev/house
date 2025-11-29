// nextjs/src/features/projects/lib/interactionFilters.ts
import type { Interaction } from "@interactions/types";

export type InteractionFilter = {
    name: string;
    description: string;
    filter: (interaction: Interaction) => boolean;
};

/**
 * Available interaction filters for project timeline
 */
export const INTERACTION_FILTERS: Record<string, InteractionFilter> = {
    // Hide incomplete tasks (todos that are not done or archived)
    hideIncompleteTasks: {
        name: "Hide Incomplete Tasks",
        description: "Hide todo interactions that are not completed or archived",
        filter: (interaction: Interaction) => {
            if (interaction.type === 'todo') {
                return interaction.status === 'done' || interaction.status === 'archived';
            }
            return true; // Show all non-todo interactions
        }
    },

    // Hide archived interactions
    hideArchived: {
        name: "Hide Archived",
        description: "Hide all archived interactions",
        filter: (interaction: Interaction) => {
            return interaction.status !== 'archived';
        }
    },

    // Show only specific types
    showOnlyNotes: {
        name: "Show Only Notes",
        description: "Show only note type interactions",
        filter: (interaction: Interaction) => {
            return interaction.type === 'note';
        }
    },

    showOnlyExpenses: {
        name: "Show Only Expenses",
        description: "Show only expense type interactions",
        filter: (interaction: Interaction) => {
            return interaction.type === 'expense';
        }
    },

    // Show completed items only
    showCompletedOnly: {
        name: "Show Completed Only",
        description: "Show only completed/done interactions",
        filter: (interaction: Interaction) => {
            return interaction.status === 'done';
        }
    }
};

/**
 * Apply multiple filters to an array of interactions
 */
export function applyFilters(
    interactions: Interaction[],
    filterKeys: string[]
): Interaction[] {
    if (filterKeys.length === 0) {
        return interactions;
    }

    return interactions.filter(interaction => {
        return filterKeys.every(filterKey => {
            const filter = INTERACTION_FILTERS[filterKey];
            return filter ? filter.filter(interaction) : true;
        });
    });
}

/**
 * Default filters applied to project timeline
 */
export const DEFAULT_PROJECT_FILTERS = ['hideIncompleteTasks'];