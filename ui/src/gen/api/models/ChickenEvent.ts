/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChickenEventTypeEnum } from './ChickenEventTypeEnum';
/**
 * Read/write serializer for flock journal entries.
 */
export type ChickenEvent = {
    readonly id: string;
    readonly household: string;
    chicken?: string | null;
    readonly chicken_name: string;
    type: ChickenEventTypeEnum;
    occurred_on: string;
    title: string;
    notes?: string;
    reminder_due_date?: string | null;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
};

