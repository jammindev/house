/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankTransaction } from './BankTransaction';
export type PaginatedBankTransactionList = {
    count: number;
    next?: string | null;
    previous?: string | null;
    results: Array<BankTransaction>;
};

