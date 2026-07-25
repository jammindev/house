/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read serializer for a monthly budget report.
 *
 * ``text`` is rendered from the frozen ``stats`` in the request user's active
 * language. ``polish`` in the serializer context enables the LLM narrative
 * (used for the single latest/detail views, not the history list — one LLM
 * call per row would be wasteful). The internal ``_polished`` cache is stripped
 * from the exposed ``stats``.
 */
export type BudgetReport = {
    readonly id: string;
    /**
     * Reported period, 'YYYY-MM'.
     */
    month: string;
    readonly text: string;
    readonly stats: string;
    readonly created_at: string;
};

