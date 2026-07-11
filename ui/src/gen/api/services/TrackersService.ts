/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PaginatedTrackerEntryList } from '../models/PaginatedTrackerEntryList';
import type { PaginatedTrackerList } from '../models/PaginatedTrackerList';
import type { PatchedTracker } from '../models/PatchedTracker';
import type { PatchedTrackerEntry } from '../models/PatchedTrackerEntry';
import type { Tracker } from '../models/Tracker';
import type { TrackerEntry } from '../models/TrackerEntry';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TrackersService {
    /**
     * Entry CRUD — all writes flow through ``trackers.services``.
     * @param limit Number of results to return per page.
     * @param offset The initial index from which to return the results.
     * @param ordering Which field to use when ordering the results.
     * @returns PaginatedTrackerEntryList
     * @throws ApiError
     */
    public static trackersEntriesList(
        limit?: number,
        offset?: number,
        ordering?: string,
    ): CancelablePromise<PaginatedTrackerEntryList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/trackers/entries/',
            query: {
                'limit': limit,
                'offset': offset,
                'ordering': ordering,
            },
        });
    }
    /**
     * Entry CRUD — all writes flow through ``trackers.services``.
     * @param requestBody
     * @returns TrackerEntry
     * @throws ApiError
     */
    public static trackersEntriesCreate(
        requestBody: TrackerEntry,
    ): CancelablePromise<TrackerEntry> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/trackers/entries/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Entry CRUD — all writes flow through ``trackers.services``.
     * @param id
     * @returns TrackerEntry
     * @throws ApiError
     */
    public static trackersEntriesRetrieve(
        id: string,
    ): CancelablePromise<TrackerEntry> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/trackers/entries/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Entry CRUD — all writes flow through ``trackers.services``.
     * @param id
     * @param requestBody
     * @returns TrackerEntry
     * @throws ApiError
     */
    public static trackersEntriesUpdate(
        id: string,
        requestBody: TrackerEntry,
    ): CancelablePromise<TrackerEntry> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/trackers/entries/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Entry CRUD — all writes flow through ``trackers.services``.
     * @param id
     * @param requestBody
     * @returns TrackerEntry
     * @throws ApiError
     */
    public static trackersEntriesPartialUpdate(
        id: string,
        requestBody?: PatchedTrackerEntry,
    ): CancelablePromise<TrackerEntry> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/trackers/entries/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Entry CRUD — all writes flow through ``trackers.services``.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static trackersEntriesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/trackers/entries/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Tracker CRUD. DELETE archives (``is_active=False``); history is kept.
     * @param limit Number of results to return per page.
     * @param offset The initial index from which to return the results.
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns PaginatedTrackerList
     * @throws ApiError
     */
    public static trackersTrackersList(
        limit?: number,
        offset?: number,
        ordering?: string,
        search?: string,
    ): CancelablePromise<PaginatedTrackerList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/trackers/trackers/',
            query: {
                'limit': limit,
                'offset': offset,
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * Tracker CRUD. DELETE archives (``is_active=False``); history is kept.
     * @param requestBody
     * @returns Tracker
     * @throws ApiError
     */
    public static trackersTrackersCreate(
        requestBody: Tracker,
    ): CancelablePromise<Tracker> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/trackers/trackers/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Tracker CRUD. DELETE archives (``is_active=False``); history is kept.
     * @param id
     * @returns Tracker
     * @throws ApiError
     */
    public static trackersTrackersRetrieve(
        id: string,
    ): CancelablePromise<Tracker> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/trackers/trackers/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Tracker CRUD. DELETE archives (``is_active=False``); history is kept.
     * @param id
     * @param requestBody
     * @returns Tracker
     * @throws ApiError
     */
    public static trackersTrackersUpdate(
        id: string,
        requestBody: Tracker,
    ): CancelablePromise<Tracker> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/trackers/trackers/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Tracker CRUD. DELETE archives (``is_active=False``); history is kept.
     * @param id
     * @param requestBody
     * @returns Tracker
     * @throws ApiError
     */
    public static trackersTrackersPartialUpdate(
        id: string,
        requestBody?: PatchedTracker,
    ): CancelablePromise<Tracker> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/trackers/trackers/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Tracker CRUD. DELETE archives (``is_active=False``); history is kept.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static trackersTrackersDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/trackers/trackers/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
