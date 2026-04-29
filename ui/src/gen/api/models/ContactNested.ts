/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddressNested } from './AddressNested';
import type { ContactStructure } from './ContactStructure';
import type { EmailNested } from './EmailNested';
import type { PhoneNested } from './PhoneNested';
export type ContactNested = {
    readonly id: string;
    household: string;
    readonly structure: ContactStructure;
    first_name?: string;
    last_name?: string;
    position?: string;
    notes?: string;
    readonly emails: Array<EmailNested>;
    readonly phones: Array<PhoneNested>;
    readonly addresses: Array<AddressNested>;
    readonly created_at: string;
    readonly updated_at: string;
};

