/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdMember } from './HouseholdMember';
/**
 * Serializer for households.
 */
export type Household = {
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
    /**
     * Latitude for the weather module (decimal degrees).
     */
    latitude?: number | null;
    /**
     * Longitude for the weather module (decimal degrees).
     */
    longitude?: number | null;
    /**
     * Human-readable place name shown in the weather module.
     */
    location_label?: string;
    context_notes?: string;
    ai_prompt_context?: string;
    readonly inbound_email_alias: string | null;
    /**
     * Optional module keys hidden for this household.
     */
    disabled_modules?: any;
    readonly members_count: string;
    readonly current_user_role: string;
    readonly members: Array<HouseholdMember>;
    readonly archived_at: string | null;
};

