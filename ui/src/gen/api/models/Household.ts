/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Serializer for households.
 */
export type Household = {
    readonly id: string;
    name: string;
    readonly created_at: string;
    address?: string;
    city?: string;
    country?: string;
    context_notes?: string;
    ai_prompt_context?: string;
    readonly inbound_email_alias: string | null;
    default_household?: boolean;
    readonly members_count: string;
};

