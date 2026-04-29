/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { EntityTypeEnum } from './EntityTypeEnum';
import type { NullEnum } from './NullEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedMaintenanceEvent = {
    readonly id?: string;
    readonly household?: string;
    board?: string | null;
    performed_by?: number | null;
    event_date?: string;
    description?: string;
    entity_type?: (EntityTypeEnum | BlankEnum | NullEnum) | null;
    entity_id?: string | null;
    readonly created_at?: string;
    readonly updated_at?: string;
};

