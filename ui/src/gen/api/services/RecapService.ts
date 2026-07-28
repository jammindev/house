/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HouseholdRecap } from '../models/HouseholdRecap';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RecapService {
    /**
     * Read-only monthly recaps of the household.
     * @returns HouseholdRecap
     * @throws ApiError
     */
    public static recapList(): CancelablePromise<Array<HouseholdRecap>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recap/',
        });
    }
    /**
     * Read-only monthly recaps of the household.
     * @param month
     * @returns HouseholdRecap
     * @throws ApiError
     */
    public static recapRetrieve(
        month: string,
    ): CancelablePromise<HouseholdRecap> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recap/{month}/',
            path: {
                'month': month,
            },
        });
    }
    /**
     * GET /api/recap/chapters/ — the chapter keys this household can be told.
     *
     * Served rather than hardcoded in the client for two reasons: a front-side list
     * would silently drift from ``CHAPTER_SPECS``, and the gating belongs here — a
     * household with the photos module off must not be offered a « Souvenirs »
     * toggle for a chapter it will never receive.
     * @returns HouseholdRecap
     * @throws ApiError
     */
    public static recapChaptersRetrieve(): CancelablePromise<HouseholdRecap> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recap/chapters/',
        });
    }
    /**
     * GET /api/recap/latest/ — ensure + return the last closed month's recap.
     *
     * Returns 204 when the month has too little to tell (``RECAP_MIN_CARDS``): the
     * snapshot still exists and stays browsable from the history, but there is no
     * story to open. « Rien à raconter » is a legitimate answer, not an error.
     * @returns HouseholdRecap
     * @throws ApiError
     */
    public static recapLatestRetrieve(): CancelablePromise<HouseholdRecap> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/recap/latest/',
        });
    }
}
