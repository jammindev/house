/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TrackerKindEnum } from './TrackerKindEnum';
/**
 * Full read/write serializer for the Tracker API.
 */
export type Tracker = {
    readonly id: string;
    readonly household: string;
    name: string;
    description?: string;
    unit?: string;
    emoji?: string;
    kind?: TrackerKindEnum;
    is_active?: boolean;
    project?: string | null;
    readonly project_title: string;
    target_type?: string | null;
    target_id?: string | null;
    readonly target_label: string;
    readonly target_url: string;
    readonly last_value: string | null;
    readonly last_entry_at: string | null;
    readonly sparkline: string;
    reserve?: string | null;
    readonly rate_per_day: string | null;
    readonly runway_days: string;
    readonly runway_until: string;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
};

