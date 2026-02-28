/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActionEnum } from './ActionEnum';
import type { EntityTypeEnum } from './EntityTypeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type PlanChangeLog = {
    readonly id: string;
    readonly household: string;
    actor: number;
    action: ActionEnum;
    entity_type: EntityTypeEnum;
    entity_id: string;
    payload?: any;
    readonly created_at: string;
    readonly updated_at: string;
};

