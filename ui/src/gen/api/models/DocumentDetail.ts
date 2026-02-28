/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Type029Enum } from './Type029Enum';
/**
 * Document detail with full metadata.
 */
export type DocumentDetail = {
    readonly id: number;
    readonly household: string;
    /**
     * Storage path: userId/interactionId/filename
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
     * Parent interaction (if any)
     */
    interaction?: string | null;
    readonly created_at: string;
    readonly created_by: number | null;
    readonly created_by_name: string;
    readonly file_url: string;
    readonly interaction_subject: string;
};

