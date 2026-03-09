/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LinkedInteractionSummary } from './LinkedInteractionSummary';
import type { ProjectLinkSummary } from './ProjectLinkSummary';
import type { Type029Enum } from './Type029Enum';
import type { ZoneLinkSummary } from './ZoneLinkSummary';
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
    readonly qualification: import('./DocumentQualification').DocumentQualification;
    readonly linked_interactions: Array<LinkedInteractionSummary>;
    readonly legacy_interaction?: string | null;
    readonly legacy_interaction_subject?: string | null;
    readonly zone_links?: Array<ZoneLinkSummary>;
    readonly project_links?: Array<ProjectLinkSummary>;
    readonly recent_interaction_candidates?: Array<LinkedInteractionSummary>;
};

