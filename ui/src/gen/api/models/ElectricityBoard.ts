/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupplyTypeEnum } from './SupplyTypeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type ElectricityBoard = {
    readonly id: string;
    readonly household: string;
    name?: string;
    supply_type: SupplyTypeEnum;
    main_notes?: string;
    is_active?: boolean;
    readonly created_at: string;
    readonly updated_at: string;
};

