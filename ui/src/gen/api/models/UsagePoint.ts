/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UsagePointKindEnum } from './UsagePointKindEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type UsagePoint = {
    readonly id: string;
    readonly household: string;
    label: string;
    name: string;
    kind: UsagePointKindEnum;
    zone: string;
    max_power_watts?: number | null;
    is_dedicated_circuit?: boolean;
    notes?: string;
    readonly created_at: string;
    readonly updated_at: string;
};

