/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for daily egg logs. Creation is an upsert on (household, date).
 */
export type PatchedEggLog = {
    readonly id?: string;
    readonly household?: string;
    date?: string;
    count?: number;
    note?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
};

