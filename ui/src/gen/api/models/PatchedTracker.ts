/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Full read/write serializer for the Tracker API.
 */
export type PatchedTracker = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    description?: string;
    unit?: string;
    emoji?: string;
    is_active?: boolean;
    project?: string | null;
    readonly project_title?: string;
    readonly last_value?: string | null;
    readonly last_entry_at?: string | null;
    readonly sparkline?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

