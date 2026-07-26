/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Full read/write serializer for the Budget API.
 *
 * ``monthly_amount`` must be strictly positive. ``is_global`` is writable but
 * the "one global per household" invariant is enforced at the DB level (unique
 * constraint) and surfaced as a clean 400 by the service layer.
 */
export type PatchedBudget = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    monthly_amount?: string;
    /**
     * The single household-wide budget that caps all expenses (budgeted + hors budget). At most one per household.
     */
    is_global?: boolean;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

