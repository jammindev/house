/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { KindEnum } from './KindEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedUsagePoint = {
    readonly id?: string;
    readonly household?: string;
    label?: string;
    name?: string;
    kind?: KindEnum;
    zone?: string;
    max_power_watts?: number | null;
    is_dedicated_circuit?: boolean;
    notes?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
};

