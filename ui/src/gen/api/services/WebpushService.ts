/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WebpushService {
    /**
     * @returns any No response body
     * @throws ApiError
     */
    public static webpushSubscribeCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/webpush/subscribe/',
        });
    }
    /**
     * Send a push to the current user — bout-en-bout diagnostic for the UI toggle.
     * @returns any No response body
     * @throws ApiError
     */
    public static webpushTestCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/webpush/test/',
        });
    }
    /**
     * @returns any No response body
     * @throws ApiError
     */
    public static webpushUnsubscribeCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/webpush/unsubscribe/',
        });
    }
    /**
     * Public VAPID key the browser needs to create a subscription.
     * @returns any No response body
     * @throws ApiError
     */
    public static webpushVapidPublicKeyRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/webpush/vapid-public-key/',
        });
    }
}
