/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdInvitationStatusEnum } from './HouseholdInvitationStatusEnum';
import type { RoleAb0Enum } from './RoleAb0Enum';
/**
 * Serializer for pending household invitations (user-facing).
 */
export type HouseholdInvitation = {
    readonly id: string;
    readonly household: string;
    readonly household_name: string;
    readonly invited_by_name: string;
    readonly role: RoleAb0Enum;
    readonly status: HouseholdInvitationStatusEnum;
    readonly created_at: string;
};

