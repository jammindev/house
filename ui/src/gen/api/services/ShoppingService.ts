/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedShoppingListItem } from '../models/PatchedShoppingListItem';
import type { ShoppingListItem } from '../models/ShoppingListItem';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ShoppingService {
    /**
     * CRUD for the household's shared shopping list.
     *
     * Writes delegate to ``shopping.services`` (the same path the agent uses).
     * @param ordering Which field to use when ordering the results.
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsList(
        ordering?: string,
    ): CancelablePromise<Array<ShoppingListItem>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/shopping/items/',
            query: {
                'ordering': ordering,
            },
        });
    }
    /**
     * CRUD for the household's shared shopping list.
     *
     * Writes delegate to ``shopping.services`` (the same path the agent uses).
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsCreate(
        requestBody: ShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/shopping/items/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for the household's shared shopping list.
     *
     * Writes delegate to ``shopping.services`` (the same path the agent uses).
     * @param id
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsRetrieve(
        id: string,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/shopping/items/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for the household's shared shopping list.
     *
     * Writes delegate to ``shopping.services`` (the same path the agent uses).
     * @param id
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsUpdate(
        id: string,
        requestBody: ShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/shopping/items/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for the household's shared shopping list.
     *
     * Writes delegate to ``shopping.services`` (the same path the agent uses).
     * @param id
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsPartialUpdate(
        id: string,
        requestBody?: PatchedShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/shopping/items/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for the household's shared shopping list.
     *
     * Writes delegate to ``shopping.services`` (the same path the agent uses).
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static shoppingItemsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/shopping/items/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Record a purchase from a shopping line (reincrements stock + expense).
     *
     * Free-text lines require ``category``; linked lines reuse their stock item.
     * On success the line is removed and the stock item is returned.
     * @param id
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsCommitToStockCreate(
        id: string,
        requestBody: ShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/shopping/items/{id}/commit-to-stock/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete several list lines at once (powers "Clear checked" + its undo).
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsBulkDeleteCreate(
        requestBody: ShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/shopping/items/bulk-delete/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Add a stock item to the list (Lot 2), deduped.
     *
     * Body: ``{stock_item: <uuid>, quantity?: number, note?: str}``. Returns the
     * list line plus ``already_in_list`` so the UI can say "déjà dans la liste".
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsFromStockCreate(
        requestBody: ShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/shopping/items/from-stock/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Low-stock items to propose adding to the list (not already on it, not dismissed).
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsSuggestionsRetrieve(): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/shopping/items/suggestions/',
        });
    }
    /**
     * Hide a suggestion until its item is restocked and drops low again.
     * @param requestBody
     * @returns ShoppingListItem
     * @throws ApiError
     */
    public static shoppingItemsSuggestionsDismissCreate(
        requestBody: ShoppingListItem,
    ): CancelablePromise<ShoppingListItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/shopping/items/suggestions/dismiss/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
