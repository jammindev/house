/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Chicken } from '../models/Chicken';
import type { ChickenEvent } from '../models/ChickenEvent';
import type { EggLog } from '../models/EggLog';
import type { PatchedChicken } from '../models/PatchedChicken';
import type { PatchedChickenEvent } from '../models/PatchedChickenEvent';
import type { PatchedEggLog } from '../models/PatchedEggLog';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ChickensService {
    /**
     * Flock register CRUD + per-hen purchase declaration.
     * @returns Chicken
     * @throws ApiError
     */
    public static chickensList(): CancelablePromise<Array<Chicken>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/',
        });
    }
    /**
     * Flock register CRUD + per-hen purchase declaration.
     * @param requestBody
     * @returns Chicken
     * @throws ApiError
     */
    public static chickensCreate(
        requestBody: Chicken,
    ): CancelablePromise<Chicken> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/chickens/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flock register CRUD + per-hen purchase declaration.
     * @param id
     * @returns Chicken
     * @throws ApiError
     */
    public static chickensRetrieve(
        id: string,
    ): CancelablePromise<Chicken> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Flock register CRUD + per-hen purchase declaration.
     * @param id
     * @param requestBody
     * @returns Chicken
     * @throws ApiError
     */
    public static chickensUpdate(
        id: string,
        requestBody: Chicken,
    ): CancelablePromise<Chicken> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/chickens/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flock register CRUD + per-hen purchase declaration.
     * @param id
     * @param requestBody
     * @returns Chicken
     * @throws ApiError
     */
    public static chickensPartialUpdate(
        id: string,
        requestBody?: PatchedChicken,
    ): CancelablePromise<Chicken> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/chickens/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flock register CRUD + per-hen purchase declaration.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static chickensDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/chickens/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Declare an expense on this hen (purchase of the hen, gear…) — US-7.
     *
     * Creates an Interaction(type=expense, kind='chickens_purchase') through
     * the shared service; no side-effect on the hen itself.
     * @param id
     * @param requestBody
     * @returns Chicken
     * @throws ApiError
     */
    public static chickensPurchaseCreate(
        id: string,
        requestBody: Chicken,
    ): CancelablePromise<Chicken> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/chickens/{id}/purchase/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated.
     * @returns EggLog
     * @throws ApiError
     */
    public static chickensEggLogsList(): CancelablePromise<Array<EggLog>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/egg-logs/',
        });
    }
    /**
     * Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated.
     * @param requestBody
     * @returns EggLog
     * @throws ApiError
     */
    public static chickensEggLogsCreate(
        requestBody: EggLog,
    ): CancelablePromise<EggLog> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/chickens/egg-logs/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated.
     * @param id
     * @returns EggLog
     * @throws ApiError
     */
    public static chickensEggLogsRetrieve(
        id: string,
    ): CancelablePromise<EggLog> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/egg-logs/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated.
     * @param id
     * @param requestBody
     * @returns EggLog
     * @throws ApiError
     */
    public static chickensEggLogsUpdate(
        id: string,
        requestBody: EggLog,
    ): CancelablePromise<EggLog> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/chickens/egg-logs/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated.
     * @param id
     * @param requestBody
     * @returns EggLog
     * @throws ApiError
     */
    public static chickensEggLogsPartialUpdate(
        id: string,
        requestBody?: PatchedEggLog,
    ): CancelablePromise<EggLog> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/chickens/egg-logs/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static chickensEggLogsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/chickens/egg-logs/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Egg-laying stats: today, 7/30-day averages, month total, 30-day series.
     * @returns EggLog
     * @throws ApiError
     */
    public static chickensEggLogsStatsRetrieve(): CancelablePromise<EggLog> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/egg-logs/stats/',
        });
    }
    /**
     * Flock journal CRUD, filterable by hen.
     * @returns ChickenEvent
     * @throws ApiError
     */
    public static chickensEventsList(): CancelablePromise<Array<ChickenEvent>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/events/',
        });
    }
    /**
     * Flock journal CRUD, filterable by hen.
     * @param requestBody
     * @returns ChickenEvent
     * @throws ApiError
     */
    public static chickensEventsCreate(
        requestBody: ChickenEvent,
    ): CancelablePromise<ChickenEvent> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/chickens/events/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flock journal CRUD, filterable by hen.
     * @param id
     * @returns ChickenEvent
     * @throws ApiError
     */
    public static chickensEventsRetrieve(
        id: string,
    ): CancelablePromise<ChickenEvent> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/events/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Flock journal CRUD, filterable by hen.
     * @param id
     * @param requestBody
     * @returns ChickenEvent
     * @throws ApiError
     */
    public static chickensEventsUpdate(
        id: string,
        requestBody: ChickenEvent,
    ): CancelablePromise<ChickenEvent> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/chickens/events/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flock journal CRUD, filterable by hen.
     * @param id
     * @param requestBody
     * @returns ChickenEvent
     * @throws ApiError
     */
    public static chickensEventsPartialUpdate(
        id: string,
        requestBody?: PatchedChickenEvent,
    ): CancelablePromise<ChickenEvent> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/chickens/events/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Flock journal CRUD, filterable by hen.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static chickensEventsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/chickens/events/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * GET/PUT the household's module settings (feed tracker link) — US-8.
     * @returns any No response body
     * @throws ApiError
     */
    public static chickensSettingsRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/settings/',
        });
    }
    /**
     * GET/PUT the household's module settings (feed tracker link) — US-8.
     * @returns any No response body
     * @throws ApiError
     */
    public static chickensSettingsUpdate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/chickens/settings/',
        });
    }
    /**
     * GET the module summary (dashboard widget + page header) — US-9/US-10.
     * @returns any No response body
     * @throws ApiError
     */
    public static chickensSummaryRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/chickens/summary/',
        });
    }
}
