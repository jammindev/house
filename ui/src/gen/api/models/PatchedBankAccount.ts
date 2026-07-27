/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankAccountKindEnum } from './BankAccountKindEnum';
/**
 * Full read/write serializer for the account API.
 *
 * ``name`` is required and non-blank; the "unique name per household" invariant
 * can only be checked at write time, so the service layer maps the DB clash to
 * a clean 400 (see ``banking.services``).
 *
 * ``opening_balance`` is deliberately NOT constrained to be positive — an
 * account can legitimately start in the red (overdraft).
 */
export type PatchedBankAccount = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    /**
     * Bank name, free text. Empty for a cash account.
     */
    bank_label?: string;
    kind?: BankAccountKindEnum;
    currency?: string;
    /**
     * Last 4 characters of the IBAN, to tell two accounts apart. The full IBAN is NEVER stored.
     */
    iban_last4?: string;
    /**
     * Balance at 'opening_balance_date'. Starting point of the derived balance computation; may be negative (overdraft).
     */
    opening_balance?: string;
    /**
     * Date the opening balance refers to. Null = not set yet.
     */
    opening_balance_date?: string | null;
    /**
     * Balance the user read on their bank at 'attested_on', used to reconstruct 'opening_balance' by subtracting the movements in between. Kept so the arithmetic can be re-checked forever after (parcours 26, lot 8) — banks that export no balance column give us no other anchor.
     */
    readonly attested_balance?: string | null;
    /**
     * Date 'attested_balance' was read. Null = never attested.
     */
    readonly attested_on?: string | null;
    /**
     * Statement importer key remembered from the last import (lot 2).
     */
    readonly default_provider?: string;
    /**
     * Column mapping remembered for this bank's export, so the format is described once and not at every import (lot 2).
     */
    readonly import_options?: any;
    /**
     * Closed account: hidden from the default list, never deleted.
     */
    archived?: boolean;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
};

