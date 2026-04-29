/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RoleAb0Enum } from './RoleAb0Enum';
/**
 * Serializer for household members.
 */
export type HouseholdMember = {
    readonly household: string;
    readonly user: number;
    readonly user_email: string;
    readonly user_display_name: string;
    role?: RoleAb0Enum;
};

