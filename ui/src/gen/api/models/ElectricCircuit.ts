/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { NullEnum } from './NullEnum';
import type { PhaseEnum } from './PhaseEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type ElectricCircuit = {
    readonly id: string;
    readonly household: string;
    board: string;
    breaker: string;
    label: string;
    name: string;
    phase?: (PhaseEnum | BlankEnum | NullEnum) | null;
    is_active?: boolean;
    notes?: string;
    readonly created_at: string;
    readonly updated_at: string;
};

