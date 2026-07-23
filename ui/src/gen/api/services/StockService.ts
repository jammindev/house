/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedStockCategory } from '../models/PatchedStockCategory';
import type { PatchedStockItem } from '../models/PatchedStockItem';
import type { StockCategory } from '../models/StockCategory';
import type { StockItem } from '../models/StockItem';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class StockService {
    /**
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns StockItem
     * @throws ApiError
     */
    public static stockList(
        ordering?: string,
        search?: string,
    ): CancelablePromise<Array<StockItem>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/stock/',
            query: {
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockCreate(
        requestBody: StockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/stock/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns StockItem
     * @throws ApiError
     */
    public static stockRetrieve(
        id: string,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/stock/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockUpdate(
        id: string,
        requestBody: StockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/stock/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockPartialUpdate(
        id: string,
        requestBody?: PatchedStockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/stock/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static stockDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/stock/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockAdjustQuantityCreate(
        id: string,
        requestBody: StockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/stock/{id}/adjust-quantity/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Return the item's consumption curve (dated levels) + depletion metrics.
     *
     * Delegates to ``services.compute_consumption``. Query param ``period`` is
     * one of ``30d``/``90d``/``1y``/``all`` (default ``90d``).
     * @param id
     * @returns StockItem
     * @throws ApiError
     */
    public static stockConsumptionRetrieve(
        id: string,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/stock/{id}/consumption/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Set the item quantity to a measured absolute value (an inventory count).
     *
     * Delegates to ``services.record_inventory``: unlike ``adjust-quantity``
     * (a signed delta), the payload is the *remaining* amount directly. Persists
     * an ``inventory`` level reading so the consumption curve has a point.
     * @param id
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockInventoryCreate(
        id: string,
        requestBody: StockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/stock/{id}/inventory/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Compose an inbound stock movement with an expense interaction.
     *
     * Single-action endpoint delegating to ``services.purchase_stock_item``:
     * increments the item quantity by `delta` (recalibrating from
     * `remaining_before` when provided) and creates an Interaction(type=expense)
     * linked to the item, persisting the dated level readings the consumption
     * curve consumes.
     * @param id
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockPurchaseCreate(
        id: string,
        requestBody: StockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/stock/{id}/purchase/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns StockCategory
     * @throws ApiError
     */
    public static stockCategoriesList(
        ordering?: string,
        search?: string,
    ): CancelablePromise<Array<StockCategory>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/stock/categories/',
            query: {
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * @param requestBody
     * @returns StockCategory
     * @throws ApiError
     */
    public static stockCategoriesCreate(
        requestBody: StockCategory,
    ): CancelablePromise<StockCategory> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/stock/categories/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns StockCategory
     * @throws ApiError
     */
    public static stockCategoriesRetrieve(
        id: string,
    ): CancelablePromise<StockCategory> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/stock/categories/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns StockCategory
     * @throws ApiError
     */
    public static stockCategoriesUpdate(
        id: string,
        requestBody: StockCategory,
    ): CancelablePromise<StockCategory> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/stock/categories/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns StockCategory
     * @throws ApiError
     */
    public static stockCategoriesPartialUpdate(
        id: string,
        requestBody?: PatchedStockCategory,
    ): CancelablePromise<StockCategory> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/stock/categories/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static stockCategoriesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/stock/categories/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns StockCategory
     * @throws ApiError
     */
    public static stockCategoriesSummaryRetrieve(): CancelablePromise<StockCategory> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/stock/categories/summary/',
        });
    }
    /**
     * Reverse a stock purchase created via the agent (undo of ``purchase``).
     *
     * Body: ``{"interaction_id": "<uuid>"}``. Delegates to
     * ``services.undo_purchase`` (deletes the expense + readings, restores the
     * quantity). Idempotent: an already-undone purchase returns 404.
     * @param requestBody
     * @returns StockItem
     * @throws ApiError
     */
    public static stockUndoPurchaseCreate(
        requestBody: StockItem,
    ): CancelablePromise<StockItem> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/stock/undo-purchase/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
