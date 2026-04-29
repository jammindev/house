/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdMember } from './HouseholdMember';
/**
 * Detailed serializer with members list.
 */
export type HouseholdDetail = {
    readonly id: string;
    name: string;
    readonly created_at: string;
    address?: string;
    city?: string;
    postal_code?: string;
    /**
     * ISO 3166-1 alpha-2 country code (e.g. FR, DE, US)
     */
    country?: string;
    /**
     * IANA timezone (e.g. Europe/Paris). Leave blank for UTC.
     */
    timezone?: string;
    context_notes?: string;
    ai_prompt_context?: string;
    readonly inbound_email_alias: string | null;
    readonly members_count: string;
    readonly current_user_role: string;
    readonly members: Array<HouseholdMember>;
    readonly archived_at: string | null;
};

