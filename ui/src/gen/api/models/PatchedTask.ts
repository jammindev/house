/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NullEnum } from './NullEnum';
import type { PriorityEnum } from './PriorityEnum';
import type { StatusF9bEnum } from './StatusF9bEnum';
/**
 * Full read/write serializer for the Task API.
 */
export type PatchedTask = {
    readonly id?: string;
    readonly household?: string;
    subject?: string;
    content?: string;
    status?: StatusF9bEnum;
    priority?: (PriorityEnum | NullEnum) | null;
    due_date?: string | null;
    is_private?: boolean;
    readonly assigned_to?: number | null;
    assigned_to_id?: number | null;
    readonly assigned_to_name?: string;
    readonly completed_by?: number | null;
    readonly completed_by_name?: string;
    readonly completed_at?: string | null;
    project?: string | null;
    readonly project_title?: string;
    zone_ids?: Array<string>;
    readonly zone_names?: string;
    /**
     * Interaction this task was created from (or migrated from)
     */
    source_interaction?: string | null;
    readonly linked_documents?: string;
    readonly linked_interactions?: string;
    readonly linked_document_count?: string;
    readonly linked_interaction_count?: string;
    document_ids?: Array<string>;
    interaction_ids?: Array<string>;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
    readonly created_by_name?: string;
};

