/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankAccount } from '../models/BankAccount';
import type { BankTransaction } from '../models/BankTransaction';
import type { ComplianceWaiver } from '../models/ComplianceWaiver';
import type { PaginatedBankTransactionList } from '../models/PaginatedBankTransactionList';
import type { PatchedBankAccount } from '../models/PatchedBankAccount';
import type { PatchedBankTransaction } from '../models/PatchedBankTransaction';
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
     * Current balance, how it was obtained, and whether it can be trusted.
     *
     * Computed at read time — there is no balance column. When the statement
     * chain has a hole, ``is_reliable`` is false and ``gaps`` says where: a
     * plausible-looking wrong number is worse than an admitted uncertainty.
     * @param id
     * @returns BankAccount
     * @throws ApiError
     */
    public static bankingAccountsBalanceRetrieve(
        id: string,
    ): CancelablePromise<BankAccount> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/accounts/{id}/balance/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * The conformity control — every écart the app knows how to detect.
     *
     * Two endpoints, and the split between them is a performance decision, not a
     * stylistic one:
     *
     * - ``GET /compliance/`` returns **counts only**. The shell badge reads it on
     * every navigation, so it must cost a bounded number of indexed ``COUNT(*)``,
     * never a scan materialised into Python.
     * - ``GET /compliance/{kind}/`` returns the paginated list of one group, and only
     * runs for the group the user actually opened.
     *
     * ``?waived=true`` returns the audit list instead of the actionable one: the
     * arbitrated écarts, each with its motive, revocable in one click. The two lists
     * together account for every detected écart — ``open + waived == detected``.
     * @returns any No response body
     * @throws ApiError
     */
    public static bankingComplianceRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/compliance/',
        });
    }
    /**
     * One group's findings. ``pk`` is the detector kind.
     * @param id
     * @returns any No response body
     * @throws ApiError
     */
    public static bankingComplianceRetrieve2(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/compliance/{id}/',
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
    /**
     * The bank journal: read and qualify statement lines.
     *
     * A transaction is **immutable in substance** — ``label_raw``, ``amount``,
     * ``booked_on`` and ``direction`` are what the bank says, and the serializer
     * marks them read-only. What a user may do is *qualify* the line: flag it as an
     * internal movement, or attach a note. Hence a narrow ``qualify`` action rather
     * than a generic PATCH: the set of writable fields is a decision, not an
     * oversight.
     * @param limit Number of results to return per page.
     * @param offset The initial index from which to return the results.
     * @returns PaginatedBankTransactionList
     * @throws ApiError
     */
    public static bankingTransactionsList(
        limit?: number,
        offset?: number,
    ): CancelablePromise<PaginatedBankTransactionList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/transactions/',
            query: {
                'limit': limit,
                'offset': offset,
            },
        });
    }
    /**
     * The bank journal: read and qualify statement lines.
     *
     * A transaction is **immutable in substance** — ``label_raw``, ``amount``,
     * ``booked_on`` and ``direction`` are what the bank says, and the serializer
     * marks them read-only. What a user may do is *qualify* the line: flag it as an
     * internal movement, or attach a note. Hence a narrow ``qualify`` action rather
     * than a generic PATCH: the set of writable fields is a decision, not an
     * oversight.
     * @param id
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsRetrieve(
        id: string,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/transactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Read or replace the split of this operation.
     *
     * ``PUT`` is a **set**: the client sends the whole split it wants. That is
     * the only way "80/40 becomes 100/20" stays atomic — per-line CRUD would
     * pass through states that violate the invariant.
     * @param id
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsAllocationsRetrieve(
        id: string,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/transactions/{id}/allocations/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Read or replace the split of this operation.
     *
     * ``PUT`` is a **set**: the client sends the whole split it wants. That is
     * the only way "80/40 becomes 100/20" stays atomic — per-line CRUD would
     * pass through states that violate the invariant.
     * @param id
     * @param requestBody
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsAllocationsUpdate(
        id: string,
        requestBody?: BankTransaction,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/banking/transactions/{id}/allocations/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Attach an existing expense to this operation (manual reconciliation).
     * @param id
     * @param requestBody
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsLinkCreate(
        id: string,
        requestBody?: BankTransaction,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/transactions/{id}/link/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flag a line as internal, or annotate it.
     *
     * The only mutation a statement line accepts. Everything else about it
     * belongs to the bank.
     * @param id
     * @param requestBody
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsQualifyPartialUpdate(
        id: string,
        requestBody?: PatchedBankTransaction,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/banking/transactions/{id}/qualify/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Best candidate expenses for this line, for the manual dialog.
     * @param id
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsSuggestionsRetrieve(
        id: string,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/transactions/{id}/suggestions/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Undo the cash counterpart — deletes only the leg we generated.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static bankingTransactionsUnlinkCashDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/banking/transactions/{id}/unlink-cash/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Detach an expense from this operation. The expense itself survives.
     * @param id
     * @param interactionId
     * @returns void
     * @throws ApiError
     */
    public static bankingTransactionsUnlinkDestroy(
        id: string,
        interactionId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/banking/transactions/{id}/unlink/{interaction_id}/',
            path: {
                'id': id,
                'interaction_id': interactionId,
            },
        });
    }
    /**
     * Mirror this withdrawal as a credit on a cash account.
     *
     * Both legs become internal movements, so neither shows up in spending —
     * the money is counted once, later, when the cash is actually spent.
     * @param id
     * @param requestBody
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsWithdrawToCashCreate(
        id: string,
        requestBody?: BankTransaction,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/transactions/{id}/withdraw-to-cash/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Money in / out over a period, internal movements excluded.
     *
     * Never add this to a budget or expense total — see the module docstring of
     * ``banking.aggregations``.
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsFlowRetrieve(): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/transactions/flow/',
        });
    }
    /**
     * Run the matcher on demand.
     *
     * Covers the other direction of the delay: the user recorded a purchase
     * *after* importing the statement, so the import-time pass could not see it.
     * @param requestBody
     * @returns BankTransaction
     * @throws ApiError
     */
    public static bankingTransactionsReconcileCreate(
        requestBody?: BankTransaction,
    ): CancelablePromise<BankTransaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/transactions/reconcile/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Arbitrations: list, create, revoke.
     *
     * No ``PATCH``: re-arbitrating goes through ``POST`` again, which
     * ``waive_finding`` turns into an update of the motive *and* of the fingerprint.
     * Letting a client PATCH the motive alone would leave a stale fingerprint
     * behind — a waiver that looks current but arbitrates a situation that has moved.
     *
     * ``DELETE`` brings the écart back identical. That reversibility is what makes
     * the control trustworthy: nothing here destroys information.
     * @returns ComplianceWaiver
     * @throws ApiError
     */
    public static bankingWaiversList(): CancelablePromise<Array<ComplianceWaiver>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/banking/waivers/',
        });
    }
    /**
     * Arbitrations: list, create, revoke.
     *
     * No ``PATCH``: re-arbitrating goes through ``POST`` again, which
     * ``waive_finding`` turns into an update of the motive *and* of the fingerprint.
     * Letting a client PATCH the motive alone would leave a stale fingerprint
     * behind — a waiver that looks current but arbitrates a situation that has moved.
     *
     * ``DELETE`` brings the écart back identical. That reversibility is what makes
     * the control trustworthy: nothing here destroys information.
     * @param requestBody
     * @returns ComplianceWaiver
     * @throws ApiError
     */
    public static bankingWaiversCreate(
        requestBody?: ComplianceWaiver,
    ): CancelablePromise<ComplianceWaiver> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/banking/waivers/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Arbitrations: list, create, revoke.
     *
     * No ``PATCH``: re-arbitrating goes through ``POST`` again, which
     * ``waive_finding`` turns into an update of the motive *and* of the fingerprint.
     * Letting a client PATCH the motive alone would leave a stale fingerprint
     * behind — a waiver that looks current but arbitrates a situation that has moved.
     *
     * ``DELETE`` brings the écart back identical. That reversibility is what makes
     * the control trustworthy: nothing here destroys information.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static bankingWaiversDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/banking/waivers/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
