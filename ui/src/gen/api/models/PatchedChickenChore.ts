/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for recurring coop chores.
 *
 * The derived block (``last_done_on``, ``next_due_on``, ``days_overdue``…) is
 * read-only and computed by ``chickens.services.chore_status`` — the same
 * function the reminder and the dashboard alert read. A second definition of
 * "en retard" computed in the client is exactly the two-voices bug the money
 * module already paid for.
 */
export type PatchedChickenChore = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    emoji?: string;
    /**
     * Days between two occurrences — also the delay after which the reminder fires.
     */
    interval_days?: number;
    starts_on?: string;
    is_active?: boolean;
    notes?: string;
    readonly status?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

