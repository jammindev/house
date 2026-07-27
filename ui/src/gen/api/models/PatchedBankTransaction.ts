/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { DirectionEnum } from './DirectionEnum';
import type { InflowNatureEnum } from './InflowNatureEnum';
/**
 * Read serializer for a statement line.
 *
 * ``label_raw``, ``amount``, ``direction`` and ``dedup_hash`` are immutable:
 * this is what the bank says. Only the qualification fields (``is_internal``,
 * ``notes``) are writable — and only through the lot 3 ``qualify`` action.
 *
 * **Où en est cette ligne** (``allocation_state``) is computed here rather than
 * in the client: the answer depends on the account's conformity window, which
 * the journal has no business re-deriving, and it has to agree — line by line —
 * with what the Contrôle tab counts. Both read
 * :func:`banking.queries.allocation_state`.
 */
export type PatchedBankTransaction = {
    readonly id?: string;
    /**
     * PROTECT: an account holding transactions cannot be deleted — it is archived instead (see services.archive_account).
     */
    readonly account?: string;
    /**
     * Operation date as printed on the statement.
     */
    readonly booked_on?: string;
    /**
     * Value date, when provided.
     */
    readonly value_on?: string | null;
    /**
     * Raw bank label. Never rewritten.
     */
    readonly label_raw?: string;
    /**
     * Signed: negative = money out.
     */
    readonly amount?: string;
    readonly currency?: string;
    readonly direction?: DirectionEnum;
    /**
     * Internal movement (ATM withdrawal, transfer between the household's own accounts). Excluded from spending aggregates — counting it would double the money.
     */
    is_internal?: boolean;
    /**
     * What this receipt is (parcours 26, lot 5). Empty on an outflow, and empty on an unclassified receipt — which is an écart the conformity control reports.
     *
     * * `salary` - Income
     * * `refund` - Refund
     * * `transfer` - Transfer between own accounts
     * * `other` - Other
     */
    inflow_nature?: (InflowNatureEnum | BlankEnum);
    /**
     * Running balance after this operation, when the bank exports it. Anchors the lot 4 balance and its chain check.
     */
    readonly balance_after?: string | null;
    /**
     * Bank-provided operation reference, when available.
     */
    readonly external_id?: string;
    notes?: string;
    /**
     * SET_NULL: transactions outlive the trace of their import.
     */
    readonly source_import?: string | null;
    /**
     * The other leg of an internal movement — typically an ATM withdrawal and the matching credit on the cash account. SET_NULL so deleting one leg never leaves the other pointing at nothing.
     */
    readonly transfer_counterpart?: string | null;
    readonly allocated_amount?: string;
    /**
     * What is still owed an explanation, never negative.
     *
     * Over-allocating is already impossible (``assert_allocation_fits``); if a
     * legacy row ever went past, showing « reste −5 € » would invite someone to
     * fix it by adding more.
     */
    readonly remaining_amount?: string;
    readonly allocation_state?: string;
    readonly created_at?: string;
};

