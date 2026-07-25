/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankAccount } from '../models/BankAccount';
import type { PatchedBankAccount } from '../models/PatchedBankAccount';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BankingService {
    /**
     * CRUD for the household's accounts.
     *
     * Every write delegates to ``banking.services`` so the REST path, the statement
     * importer (lot 2) and any future agent path stay identical. Any household
     * member may manage accounts — money is a household-wide matter, like budgets.
     *
     * ``DELETE`` archives instead of destroying: an account owns the imported
     * history from lot 2 on, so closing it must stay reversible.
     * @returns BankAccount
     * @throws ApiError
     */
    public static bankingAccountsList(): CancelablePromise<Array<BankAccount>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/accounts/',
        });
    }
    /**
     * CRUD for the household's accounts.
     *
     * Every write delegates to ``banking.services`` so the REST path, the statement
     * importer (lot 2) and any future agent path stay identical. Any household
     * member may manage accounts — money is a household-wide matter, like budgets.
     *
     * ``DELETE`` archives instead of destroying: an account owns the imported
     * history from lot 2 on, so closing it must stay reversible.
     * @param requestBody
     * @returns BankAccount
     * @throws ApiError
     */
    public static bankingAccountsCreate(
        requestBody: BankAccount,
    ): CancelablePromise<BankAccount> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/accounts/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for the household's accounts.
     *
     * Every write delegates to ``banking.services`` so the REST path, the statement
     * importer (lot 2) and any future agent path stay identical. Any household
     * member may manage accounts — money is a household-wide matter, like budgets.
     *
     * ``DELETE`` archives instead of destroying: an account owns the imported
     * history from lot 2 on, so closing it must stay reversible.
     * @param id
     * @returns BankAccount
     * @throws ApiError
     */
    public static bankingAccountsRetrieve(
        id: string,
    ): CancelablePromise<BankAccount> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/accounts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for the household's accounts.
     *
     * Every write delegates to ``banking.services`` so the REST path, the statement
     * importer (lot 2) and any future agent path stay identical. Any household
     * member may manage accounts — money is a household-wide matter, like budgets.
     *
     * ``DELETE`` archives instead of destroying: an account owns the imported
     * history from lot 2 on, so closing it must stay reversible.
     * @param id
     * @param requestBody
     * @returns BankAccount
     * @throws ApiError
     */
    public static bankingAccountsUpdate(
        id: string,
        requestBody: BankAccount,
    ): CancelablePromise<BankAccount> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/banking/accounts/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for the household's accounts.
     *
     * Every write delegates to ``banking.services`` so the REST path, the statement
     * importer (lot 2) and any future agent path stay identical. Any household
     * member may manage accounts — money is a household-wide matter, like budgets.
     *
     * ``DELETE`` archives instead of destroying: an account owns the imported
     * history from lot 2 on, so closing it must stay reversible.
     * @param id
     * @param requestBody
     * @returns BankAccount
     * @throws ApiError
     */
    public static bankingAccountsPartialUpdate(
        id: string,
        requestBody?: PatchedBankAccount,
    ): CancelablePromise<BankAccount> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/banking/accounts/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for the household's accounts.
     *
     * Every write delegates to ``banking.services`` so the REST path, the statement
     * importer (lot 2) and any future agent path stay identical. Any household
     * member may manage accounts — money is a household-wide matter, like budgets.
     *
     * ``DELETE`` archives instead of destroying: an account owns the imported
     * history from lot 2 on, so closing it must stay reversible.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static bankingAccountsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/banking/accounts/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
