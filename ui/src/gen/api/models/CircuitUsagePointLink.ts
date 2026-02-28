/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Base serializer with shared household validation helpers.
 */
export type CircuitUsagePointLink = {
    readonly id: string;
    readonly household: string;
    circuit: string;
    usage_point: string;
    is_active?: boolean;
    readonly deactivated_at: string | null;
    readonly deactivated_by: number | null;
    readonly created_at: string;
    readonly updated_at: string;
};

