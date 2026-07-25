/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Briefing } from '../models/Briefing';
import type { PatchedBriefing } from '../models/PatchedBriefing';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BriefingsService {
    /**
     * CRUD for a household's briefings.
     *
     * The list is visibility-filtered: every member sees the household's **shared**
     * briefings plus their **own private** ones. Writes delegate to
     * ``briefings.services`` (the single write path).
     * @param ordering Which field to use when ordering the results.
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsList(
        ordering?: string,
    ): CancelablePromise<Array<Briefing>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/briefings/briefings/',
            query: {
                'ordering': ordering,
            },
        });
    }
    /**
     * CRUD for a household's briefings.
     *
     * The list is visibility-filtered: every member sees the household's **shared**
     * briefings plus their **own private** ones. Writes delegate to
     * ``briefings.services`` (the single write path).
     * @param requestBody
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsCreate(
        requestBody: Briefing,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/briefings/briefings/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for a household's briefings.
     *
     * The list is visibility-filtered: every member sees the household's **shared**
     * briefings plus their **own private** ones. Writes delegate to
     * ``briefings.services`` (the single write path).
     * @param id
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsRetrieve(
        id: string,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/briefings/briefings/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for a household's briefings.
     *
     * The list is visibility-filtered: every member sees the household's **shared**
     * briefings plus their **own private** ones. Writes delegate to
     * ``briefings.services`` (the single write path).
     * @param id
     * @param requestBody
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsUpdate(
        id: string,
        requestBody: Briefing,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/briefings/briefings/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for a household's briefings.
     *
     * The list is visibility-filtered: every member sees the household's **shared**
     * briefings plus their **own private** ones. Writes delegate to
     * ``briefings.services`` (the single write path).
     * @param id
     * @param requestBody
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsPartialUpdate(
        id: string,
        requestBody?: PatchedBriefing,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/briefings/briefings/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for a household's briefings.
     *
     * The list is visibility-filtered: every member sees the household's **shared**
     * briefings plus their **own private** ones. Writes delegate to
     * ``briefings.services`` (the single write path).
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static briefingsBriefingsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/briefings/briefings/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Recent send attempts for this briefing (lot 5) — read-grade access.
     * @param id
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsHistoryRetrieve(
        id: string,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/briefings/briefings/{id}/history/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Generate the briefing content for the requesting user — no Telegram send.
     *
     * Also evaluates the condition (if any) so the UI can show whether the
     * briefing would actually go out right now.
     * @param id
     * @param requestBody
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsPreviewCreate(
        id: string,
        requestBody: Briefing,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/briefings/briefings/{id}/preview/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Generate + push the briefing to its recipients right now (manual).
     * @param id
     * @param requestBody
     * @returns Briefing
     * @throws ApiError
     */
    public static briefingsBriefingsSendNowCreate(
        id: string,
        requestBody: Briefing,
    ): CancelablePromise<Briefing> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/briefings/briefings/{id}/send-now/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
