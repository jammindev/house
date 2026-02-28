/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProcessingStatusEnum } from './ProcessingStatusEnum';
export type IncomingEmail = {
    readonly id: string;
    household: string;
    message_id: string;
    from_email: string;
    from_name?: string;
    to_email: string;
    subject?: string;
    body_text?: string;
    body_html?: string;
    processing_status?: ProcessingStatusEnum;
    processing_error?: string | null;
    interaction?: string | null;
    metadata?: any;
    received_at: string;
    processed_at?: string | null;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly updated_by: number | null;
};

