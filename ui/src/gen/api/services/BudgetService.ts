/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Budget } from '../models/Budget';
import type { BudgetReport } from '../models/BudgetReport';
import type { PatchedBudget } from '../models/PatchedBudget';
import type { PatchedRecurringExpense } from '../models/PatchedRecurringExpense';
import type { RecurringExpense } from '../models/RecurringExpense';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BudgetService {
    /**
     * CRUD for household budgets + the monthly overview.
     *
     * Every write delegates to ``budget.services`` so the REST path and the agent
     * path stay identical. Any household member may manage budgets (Lot 1 decision).
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsList(): CancelablePromise<Array<Budget>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/budgets/',
        });
    }
    /**
     * CRUD for household budgets + the monthly overview.
     *
     * Every write delegates to ``budget.services`` so the REST path and the agent
     * path stay identical. Any household member may manage budgets (Lot 1 decision).
     * @param requestBody
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsCreate(
        requestBody: Budget,
    ): CancelablePromise<Budget> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/budget/budgets/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for household budgets + the monthly overview.
     *
     * Every write delegates to ``budget.services`` so the REST path and the agent
     * path stay identical. Any household member may manage budgets (Lot 1 decision).
     * @param id
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsRetrieve(
        id: string,
    ): CancelablePromise<Budget> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/budgets/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for household budgets + the monthly overview.
     *
     * Every write delegates to ``budget.services`` so the REST path and the agent
     * path stay identical. Any household member may manage budgets (Lot 1 decision).
     * @param id
     * @param requestBody
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsUpdate(
        id: string,
        requestBody: Budget,
    ): CancelablePromise<Budget> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/budget/budgets/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for household budgets + the monthly overview.
     *
     * Every write delegates to ``budget.services`` so the REST path and the agent
     * path stay identical. Any household member may manage budgets (Lot 1 decision).
     * @param id
     * @param requestBody
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsPartialUpdate(
        id: string,
        requestBody?: PatchedBudget,
    ): CancelablePromise<Budget> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/budget/budgets/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for household budgets + the monthly overview.
     *
     * Every write delegates to ``budget.services`` so the REST path and the agent
     * path stay identical. Any household member may manage budgets (Lot 1 decision).
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static budgetBudgetsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/budget/budgets/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * GET /api/budget/budgets/analysis/?months=12&budget=<id>
     *
     * La lecture longue : séries mensuelles par budget, répartition,
     * fournisseurs, plus grosses dépenses. Le panneau Budgets ne répond qu'à
     * « ce mois-ci tient-il ? » ; une dérive lente, ou une catégorie sans
     * plafond, n'y produisent aucun signal.
     *
     * ``budget`` restreint tout le calcul à une enveloppe. Un id inconnu du
     * foyer donne une fenêtre vide, jamais les données d'un autre foyer : le
     * filtre s'applique **après** le scope, il ne peut pas l'élargir.
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsAnalysisRetrieve(): CancelablePromise<Budget> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/budgets/analysis/',
        });
    }
    /**
     * GET /api/budget/budgets/overview/
     *
     * The month's budgets with spent/ceiling, the "hors budget" total and the
     * optional global cap. Empty-but-valid shape when no household context.
     * @returns Budget
     * @throws ApiError
     */
    public static budgetBudgetsOverviewRetrieve(): CancelablePromise<Budget> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/budgets/overview/',
        });
    }
    /**
     * CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.
     *
     * Every write delegates to ``budget.services`` (shared with the agent). Any
     * household member may manage recurrences (parcours 21 decision).
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringList(): CancelablePromise<Array<RecurringExpense>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/recurring/',
        });
    }
    /**
     * CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.
     *
     * Every write delegates to ``budget.services`` (shared with the agent). Any
     * household member may manage recurrences (parcours 21 decision).
     * @param requestBody
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringCreate(
        requestBody: RecurringExpense,
    ): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/budget/recurring/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.
     *
     * Every write delegates to ``budget.services`` (shared with the agent). Any
     * household member may manage recurrences (parcours 21 decision).
     * @param id
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringRetrieve(
        id: string,
    ): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/recurring/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.
     *
     * Every write delegates to ``budget.services`` (shared with the agent). Any
     * household member may manage recurrences (parcours 21 decision).
     * @param id
     * @param requestBody
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringUpdate(
        id: string,
        requestBody: RecurringExpense,
    ): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/budget/recurring/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.
     *
     * Every write delegates to ``budget.services`` (shared with the agent). Any
     * household member may manage recurrences (parcours 21 decision).
     * @param id
     * @param requestBody
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringPartialUpdate(
        id: string,
        requestBody?: PatchedRecurringExpense,
    ): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/budget/recurring/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.
     *
     * Every write delegates to ``budget.services`` (shared with the agent). Any
     * household member may manage recurrences (parcours 21 decision).
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static budgetRecurringDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/budget/recurring/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * POST /api/budget/recurring/{id}/confirm/ — confirm a due occurrence.
     *
     * Creates the real expense (optionally with an edited ``amount``) and advances
     * the schedule. Returns the updated recurrence + the created interaction id so
     * the client can offer an exact undo (delete expense + restore next_due_date).
     * @param id
     * @param requestBody
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringConfirmCreate(
        id: string,
        requestBody: RecurringExpense,
    ): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/budget/recurring/{id}/confirm/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * GET /api/budget/recurring/due/ — recurrences due now (next_due_date <= today).
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringDueRetrieve(): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/recurring/due/',
        });
    }
    /**
     * GET /api/budget/recurring/projection/ — upcoming outflows over 30/90 days.
     * @returns RecurringExpense
     * @throws ApiError
     */
    public static budgetRecurringProjectionRetrieve(): CancelablePromise<RecurringExpense> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/recurring/projection/',
        });
    }
    /**
     * Read-only monthly budget reports (parcours 21 lot 3).
     *
     * ``list`` = history (deterministic text, cheap). ``latest`` ensures the last
     * closed month's report exists then returns it with the AI-polished narrative.
     * @returns BudgetReport
     * @throws ApiError
     */
    public static budgetReportsList(): CancelablePromise<Array<BudgetReport>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/reports/',
        });
    }
    /**
     * Read-only monthly budget reports (parcours 21 lot 3).
     *
     * ``list`` = history (deterministic text, cheap). ``latest`` ensures the last
     * closed month's report exists then returns it with the AI-polished narrative.
     * @param month
     * @returns BudgetReport
     * @throws ApiError
     */
    public static budgetReportsRetrieve(
        month: string,
    ): CancelablePromise<BudgetReport> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/reports/{month}/',
            path: {
                'month': month,
            },
        });
    }
    /**
     * GET /api/budget/reports/latest/ — ensure + return last closed month's report.
     * @returns BudgetReport
     * @throws ApiError
     */
    public static budgetReportsLatestRetrieve(): CancelablePromise<BudgetReport> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/budget/reports/latest/',
        });
    }
}
