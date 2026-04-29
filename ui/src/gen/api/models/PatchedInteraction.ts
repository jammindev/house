/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { NullEnum } from './NullEnum';
import type { StatusF9bEnum } from './StatusF9bEnum';
import type { Type43eEnum } from './Type43eEnum';
/**
 * Interaction list/create serializer.
 */
export type PatchedInteraction = {
    readonly id?: string;
    readonly household?: string;
    subject?: string;
    content?: string;
    type?: Type43eEnum;
    /**
     * Status (mainly for todos)
     *
     * * `backlog` - Backlog
     * * `pending` - Pending
     * * `in_progress` - In Progress
     * * `done` - Done
     * * `archived` - Archived
     */
    status?: (StatusF9bEnum | BlankEnum | NullEnum) | null;
    /**
     * Whether this interaction is private to the creator
     */
    is_private?: boolean;
    /**
     * When this interaction occurred
     */
    occurred_at?: string | null;
    readonly tags?: string;
    tags_input?: Array<string>;
    /**
     * Expense amounts, vendor info, etc.
     */
    metadata?: any;
    /**
     * Full-text searchable content with OCR from documents
     */
    enriched_text?: string;
    project?: string | null;
    readonly project_title?: string;
    zone_ids?: Array<string>;
    readonly zone_names?: string;
    readonly document_count?: string;
    readonly linked_document_ids?: string;
    document_ids?: Array<string>;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
    readonly created_by_name?: string;
};

