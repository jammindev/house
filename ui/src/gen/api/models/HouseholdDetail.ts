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
    country?: string;
    context_notes?: string;
    ai_prompt_context?: string;
    readonly inbound_email_alias: string | null;
    default_household?: boolean;
    readonly members_count: string;
    readonly members: Array<HouseholdMember>;
};

