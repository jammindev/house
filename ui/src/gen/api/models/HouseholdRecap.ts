/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A recap as the client consumes it: localized cards, no raw snapshot.
 *
 * ``chapters`` is rendered from the frozen ``stats`` in the request's active
 * language. ``polish`` in the serializer context enables the warmer captions —
 * used for a single recap, not for the history list, where one LLM call per row
 * would be wasteful. The raw ``stats`` (and its ``_polished`` cache) are never
 * exposed: they are an internal format, and publishing them would make every
 * client a second renderer.
 */
export type HouseholdRecap = {
    readonly id: string;
    /**
     * Reported period, 'YYYY-MM'.
     */
    month: string;
    readonly card_count: number;
    readonly chapters: string;
    readonly created_at: string;
};

