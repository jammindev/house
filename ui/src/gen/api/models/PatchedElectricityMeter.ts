/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TariffTypeEnum } from './TariffTypeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedElectricityMeter = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    serial_number?: string;
    zone?: string | null;
    tariff_type?: TariffTypeEnum;
    timezone?: string;
    notes?: string;
    is_active?: boolean;
    readonly created_at?: string;
    readonly updated_at?: string;
};

