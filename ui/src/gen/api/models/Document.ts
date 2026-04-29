/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Type029Enum } from './Type029Enum';
/**
 * Document list/create serializer.
 */
export type Document = {
    readonly id: number;
    readonly household: string;
    /**
     * Storage path: documents/{household_id}/{year}/{month}/{uuid}-{filename}
     */
    file_path: string;
    name: string;
    mime_type?: string;
    type?: Type029Enum;
    notes?: string;
    /**
     * Extracted text from OCR/processing
     */
    ocr_text?: string;
    /**
     * Size, dimensions, processing status, etc.
     */
    metadata?: any;
    /**
     * If True, only the uploader can see this document.
     */
    is_private?: boolean;
    /**
     * Parent interaction (if any)
     */
    interaction?: string | null;
    readonly created_at: string;
    readonly created_by: number | null;
    readonly created_by_name: string;
    readonly file_url: string;
    readonly thumbnail_url: string;
    readonly medium_url: string;
    readonly qualification: string;
    readonly linked_interactions: string;
    readonly legacy_interaction: string;
    readonly legacy_interaction_subject: string;
};

