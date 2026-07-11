/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Type0e0Enum } from './Type0e0Enum';
/**
 * Interaction detail with full related data.
 */
export type InteractionDetail = {
    readonly id: string;
    readonly household: string;
    subject: string;
    content?: string;
    type?: Type0e0Enum;
    /**
     * Whether this interaction is private to the creator
     */
    is_private?: boolean;
    /**
     * When this interaction occurred
     */
    occurred_at?: string | null;
    readonly tags: string;
    tags_input?: Array<string>;
    /**
     * Expense amounts, vendor info, etc.
     */
    metadata?: any;
    /**
     * Full-text searchable content with OCR from documents
     */
    enriched_text?: string;
    source_type?: string | null;
    source_id?: string | null;
    readonly source_label: string;
    zone_ids: Array<string>;
    readonly zone_names: string;
    readonly zone_id_list: string;
    readonly document_count: string;
    readonly linked_document_ids: string;
    document_ids?: Array<string>;
    readonly contacts: string;
    contact_ids?: Array<string>;
    readonly structures: string;
    structure_ids?: Array<string>;
    readonly equipments: string;
    equipment_ids?: Array<string>;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly created_by_name: string;
    readonly zones_detail: string;
    readonly documents: string;
};

