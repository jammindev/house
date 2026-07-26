/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Status31eEnum } from './Status31eEnum';
/**
 * Read serializer for the import history.
 *
 * Everything is read-only: an import trace is a fact, not a form. A failed
 * import is a perfectly valid row — the client reads ``status`` and ``error``
 * rather than relying on the HTTP code (see ``StatementImportViewSet``).
 */
export type StatementImport = {
    readonly id: string;
    readonly account: string;
    readonly account_name: string;
    /**
     * Importer key used (e.g. generic_csv). Empty when unrecognized.
     */
    readonly provider: string;
    readonly filename: string;
    readonly status: Status31eEnum;
    readonly created_count: number;
    /**
     * Lines already present — the normal outcome of a re-import.
     */
    readonly skipped_count: number;
    /**
     * Lines this import reconciled by itself with expenses already typed into the app (lot 6). The number the user actually cares about: it is what they did NOT have to sort out by hand.
     */
    readonly auto_matched_count: number;
    readonly error: string;
    readonly period_start: string | null;
    readonly period_end: string | null;
    readonly created_at: string;
};

