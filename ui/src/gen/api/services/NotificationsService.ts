/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Notification } from '../models/Notification';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class NotificationsService {
    /**
     * @returns Notification
     * @throws ApiError
     */
    public static notificationsList(): CancelablePromise<Array<Notification>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/notifications/',
        });
    }
    /**
     * @param id
     * @returns Notification
     * @throws ApiError
     */
    public static notificationsRetrieve(
        id: string,
    ): CancelablePromise<Notification> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/notifications/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns Notification
     * @throws ApiError
     */
    public static notificationsMarkReadCreate(
        id: string,
        requestBody?: Notification,
    ): CancelablePromise<Notification> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/notifications/{id}/mark-read/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param requestBody
     * @returns Notification
     * @throws ApiError
     */
    public static notificationsMarkAllReadCreate(
        requestBody?: Notification,
    ): CancelablePromise<Notification> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/notifications/mark-all-read/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * The types the settings screen may offer to silence.
     *
     * Served rather than duplicated in the front: `MUTABLE_TYPES` is what the
     * write path actually enforces, so a hard-coded list would eventually
     * offer a checkbox the API refuses, or hide one it would accept.
     * @returns Notification
     * @throws ApiError
     */
    public static notificationsMutableTypesRetrieve(): CancelablePromise<Notification> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/notifications/mutable-types/',
        });
    }
    /**
     * @returns Notification
     * @throws ApiError
     */
    public static notificationsUnreadCountRetrieve(): CancelablePromise<Notification> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/notifications/unread-count/',
        });
    }
}
