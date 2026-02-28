/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { CurveTypeEnum } from './CurveTypeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedBreaker = {
    readonly id?: string;
    readonly household?: string;
    board?: string;
    rcd?: string | null;
    label?: string;
    rating_amps?: number;
    curve_type?: (CurveTypeEnum | BlankEnum);
    notes?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
};

