/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProjectStatusEnum } from './ProjectStatusEnum';
import type { ProjectTypeEnum } from './ProjectTypeEnum';
export type PatchedProject = {
    readonly id?: string;
    household?: string;
    title?: string;
    description?: string;
    status?: ProjectStatusEnum;
    priority?: number;
    start_date?: string | null;
    due_date?: string | null;
    closed_at?: string | null;
    tags?: Array<string>;
    planned_budget?: string;
    actual_cost_cached?: string;
    cover_interaction?: string | null;
    project_group?: string | null;
    type?: ProjectTypeEnum;
    is_pinned?: boolean;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
    readonly updated_by?: number | null;
};

