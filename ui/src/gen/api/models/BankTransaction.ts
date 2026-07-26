/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DirectionEnum } from './DirectionEnum';
/**
 * Read serializer for a statement line.
 *
 * ``label_raw``, ``amount``, ``direction`` and ``dedup_hash`` are immutable:
 * this is what the bank says. Only the qualification fields (``is_internal``,
 * ``notes``) are writable — and only through the lot 3 ``qualify`` action.
 */
export type BankTransaction = {
    readonly id: string;
    /**
     * PROTECT: an account holding transactions cannot be deleted — it is archived instead (see services.archive_account).
     */
    readonly account: string;
    /**
     * Operation date as printed on the statement.
     */
    readonly booked_on: string;
    /**
     * Value date, when provided.
     */
    readonly value_on: string | null;
    /**
     * Raw bank label. Never rewritten.
     */
    readonly label_raw: string;
    /**
     * Signed: negative = money out.
     */
    readonly amount: string;
    readonly currency: string;
    readonly direction: DirectionEnum;
    /**
     * Internal movement (ATM withdrawal, transfer between the household's own accounts). Excluded from spending aggregates — counting it would double the money.
     */
    is_internal?: boolean;
    /**
     * Running balance after this operation, when the bank exports it. Anchors the lot 4 balance and its chain check.
     */
    readonly balance_after: string | null;
    /**
     * Bank-provided operation reference, when available.
     */
    readonly external_id: string;
    notes?: string;
    /**
     * SET_NULL: transactions outlive the trace of their import.
     */
    readonly source_import: string | null;
    readonly created_at: string;
};

