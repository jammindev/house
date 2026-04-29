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
}
