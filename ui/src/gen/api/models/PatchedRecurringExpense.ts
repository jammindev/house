/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CadenceEnum } from './CadenceEnum';
/**
 * Read/write serializer for recurring expenses.
 *
 * ``amount`` must be strictly positive. ``budget_id`` (write) attaches an
 * optional named budget; ``budget`` (read) echoes ``{id, name}``. Household
 * scope + no-global-target validation live in the service layer.
 */
export type PatchedRecurringExpense = {
    readonly id?: string;
    readonly household?: string;
    label?: string;
    amount?: string;
    cadence?: CadenceEnum;
    next_due_date?: string;
    supplier?: string;
    notes?: string;
    readonly budget?: string;
    budget_id?: string | null;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

