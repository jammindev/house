/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RegisterEnum } from './RegisterEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedMeterReading = {
    readonly id?: string;
    readonly household?: string;
    meter?: string;
    register?: RegisterEnum;
    reading_at?: string;
    index_kwh?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
};

