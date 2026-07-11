/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConsumptionImportStatusEnum } from './ConsumptionImportStatusEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type ConsumptionImport = {
    readonly id: string;
    readonly household: string;
    readonly meter: string;
    readonly provider: string;
    readonly filename: string;
    readonly status: ConsumptionImportStatusEnum;
    readonly created_count: number;
    readonly skipped_count: number;
    readonly error: string;
    readonly created_at: string;
};

