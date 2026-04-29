/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { NfC15100CompliantEnum } from './NfC15100CompliantEnum';
import type { NullEnum } from './NullEnum';
import type { SupplyTypeEnum } from './SupplyTypeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type ElectricityBoard = {
    readonly id: string;
    readonly household: string;
    label?: string | null;
    parent?: string | null;
    zone: string;
    name?: string;
    supply_type: SupplyTypeEnum;
    location?: string;
    rows?: number | null;
    slots_per_row?: number | null;
    last_inspection_date?: string | null;
    nf_c_15100_compliant?: (NfC15100CompliantEnum | BlankEnum | NullEnum) | null;
    main_notes?: string;
    is_active?: boolean;
    readonly created_at: string;
    readonly updated_at: string;
};

