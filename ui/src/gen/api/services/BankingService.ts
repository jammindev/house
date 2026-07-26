/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankAccount } from '../models/BankAccount';
import type { PatchedBankAccount } from '../models/PatchedBankAccount';
import type { StatementImport } from '../models/StatementImport';
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
    /**
     * Statement imports: history (GET), file drop (POST), preview (POST).
     *
     * **No ``DELETE``.** Deleting an import then re-importing would recreate the
     * transactions with fresh UUIDs and silently drop every allocation attached to
     * them (lot 5). The history is append-only by design.
     *
     * **A business failure is a 201, not a 400.** An unreadable file or a wrong
     * mapping is a normal outcome the user must be able to read and act on: it
     * returns the created trace with ``status='failed'`` and zero transactions.
     * Only malformed *requests* (missing account, unknown provider, bad JSON) are
     * 4xx. Same contract as ``electricity.ConsumptionImportViewSet``.
     * @returns StatementImport
     * @throws ApiError
     */
    public static bankingImportsList(): CancelablePromise<Array<StatementImport>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/imports/',
        });
    }
    /**
     * Statement imports: history (GET), file drop (POST), preview (POST).
     *
     * **No ``DELETE``.** Deleting an import then re-importing would recreate the
     * transactions with fresh UUIDs and silently drop every allocation attached to
     * them (lot 5). The history is append-only by design.
     *
     * **A business failure is a 201, not a 400.** An unreadable file or a wrong
     * mapping is a normal outcome the user must be able to read and act on: it
     * returns the created trace with ``status='failed'`` and zero transactions.
     * Only malformed *requests* (missing account, unknown provider, bad JSON) are
     * 4xx. Same contract as ``electricity.ConsumptionImportViewSet``.
     * @param formData
     * @returns StatementImport
     * @throws ApiError
     */
    public static bankingImportsCreate(
        formData?: StatementImport,
    ): CancelablePromise<StatementImport> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/imports/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
    /**
     * Statement imports: history (GET), file drop (POST), preview (POST).
     *
     * **No ``DELETE``.** Deleting an import then re-importing would recreate the
     * transactions with fresh UUIDs and silently drop every allocation attached to
     * them (lot 5). The history is append-only by design.
     *
     * **A business failure is a 201, not a 400.** An unreadable file or a wrong
     * mapping is a normal outcome the user must be able to read and act on: it
     * returns the created trace with ``status='failed'`` and zero transactions.
     * Only malformed *requests* (missing account, unknown provider, bad JSON) are
     * 4xx. Same contract as ``electricity.ConsumptionImportViewSet``.
     * @param id
     * @returns StatementImport
     * @throws ApiError
     */
    public static bankingImportsRetrieve(
        id: string,
    ): CancelablePromise<StatementImport> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/imports/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Detected format, column names and first lines — to build the mapping.
     * @param formData
     * @returns StatementImport
     * @throws ApiError
     */
    public static bankingImportsPreviewCreate(
        formData?: StatementImport,
    ): CancelablePromise<StatementImport> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/imports/preview/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
}
