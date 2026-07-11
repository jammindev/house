/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChickenStatusEnum } from './ChickenStatusEnum';
/**
 * Full read/write serializer for the Chicken API.
 */
export type PatchedChicken = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    breed?: string;
    color?: string;
    hatched_on?: string | null;
    acquired_on?: string | null;
    status?: ChickenStatusEnum;
    notes?: string;
    readonly zone?: string | null;
    zone_id?: string | null;
    readonly zone_name?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

