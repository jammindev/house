/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedWaterReading } from '../models/PatchedWaterReading';
import type { WaterReading } from '../models/WaterReading';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WaterService {
    /**
     * Server-side aggregation of the reading-derived consumption.
     * @returns any No response body
     * @throws ApiError
     */
    public static waterConsumptionSummaryRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/water/consumption/summary/',
        });
    }
    /**
     * Readings CRUD — newest first.
     * @returns WaterReading
     * @throws ApiError
     */
    public static waterReadingsList(): CancelablePromise<Array<WaterReading>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/water/readings/',
        });
    }
    /**
     * Readings CRUD — newest first.
     * @param requestBody
     * @returns WaterReading
     * @throws ApiError
     */
    public static waterReadingsCreate(
        requestBody: WaterReading,
    ): CancelablePromise<WaterReading> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/water/readings/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Readings CRUD — newest first.
     * @param id
     * @returns WaterReading
     * @throws ApiError
     */
    public static waterReadingsRetrieve(
        id: string,
    ): CancelablePromise<WaterReading> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/water/readings/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Readings CRUD — newest first.
     * @param id
     * @param requestBody
     * @returns WaterReading
     * @throws ApiError
     */
    public static waterReadingsUpdate(
        id: string,
        requestBody: WaterReading,
    ): CancelablePromise<WaterReading> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/water/readings/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Readings CRUD — newest first.
     * @param id
     * @param requestBody
     * @returns WaterReading
     * @throws ApiError
     */
    public static waterReadingsPartialUpdate(
        id: string,
        requestBody?: PatchedWaterReading,
    ): CancelablePromise<WaterReading> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/water/readings/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Readings CRUD — newest first.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static waterReadingsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/water/readings/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
