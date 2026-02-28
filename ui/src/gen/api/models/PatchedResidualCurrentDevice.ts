/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { TypeCodeEnum } from './TypeCodeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedResidualCurrentDevice = {
    readonly id?: string;
    readonly household?: string;
    board?: string;
    label?: string;
    rating_amps?: number | null;
    sensitivity_ma?: number | null;
    type_code?: (TypeCodeEnum | BlankEnum);
    notes?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
};

