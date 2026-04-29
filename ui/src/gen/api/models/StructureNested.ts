/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddressNested } from './AddressNested';
import type { EmailNested } from './EmailNested';
import type { PhoneNested } from './PhoneNested';
export type StructureNested = {
    readonly id: string;
    household: string;
    name?: string;
    type?: string;
    description?: string;
    website?: string;
    tags?: Array<string>;
    readonly emails: Array<EmailNested>;
    readonly phones: Array<PhoneNested>;
    readonly addresses: Array<AddressNested>;
    readonly created_at: string;
    readonly updated_at: string;
};

