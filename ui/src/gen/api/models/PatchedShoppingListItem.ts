/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for a shopping list line.
 *
 * ``checked`` is the writable face of ``checked_at``: sending ``checked=true``
 * stamps ``checked_at`` (now), ``false`` clears it. The raw ``checked_at`` is
 * exposed read-only for display/sorting.
 */
export type PatchedShoppingListItem = {
    readonly id?: string;
    readonly household?: string;
    label?: string;
    quantity?: string | null;
    unit?: string;
    note?: string;
    stock_item?: string | null;
    readonly stock_item_name?: string;
    readonly stock_item_status?: string;
    readonly stock_item_emoji?: string;
    checked?: boolean;
    readonly checked_at?: string | null;
    sort_order?: number;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
    readonly created_by_name?: string;
};

