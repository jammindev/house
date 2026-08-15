/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for a budget category.
 *
 * A category is a **heading**, so it validates almost nothing: a non-blank name
 * and, when given, a strictly positive ceiling. There is no rule about what it
 * may contain, because there is nothing to protect — no expense can point at a
 * category, so a category can never hold money of its own.
 */
export type PatchedBudgetCategory = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    monthly_amount?: string | null;
    readonly budget_count?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

