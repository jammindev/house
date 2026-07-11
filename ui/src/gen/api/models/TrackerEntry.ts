/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for tracker entries.
 */
export type TrackerEntry = {
    readonly id: string;
    tracker: string;
    value: string;
    occurred_at?: string;
    note?: string;
    readonly created_at: string;
    readonly created_by: number | null;
};

