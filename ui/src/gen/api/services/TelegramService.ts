/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TelegramService {
    /**
     * ``GET``/``DELETE /api/telegram/account/`` — link status + unlink.
     *
     * ``enabled`` tells the frontend whether to show the Telegram card at all
     * (the channel is server-side opt-in via env vars).
     * @returns any No response body
     * @throws ApiError
     */
    public static telegramAccountRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/telegram/account/',
        });
    }
    /**
     * ``GET``/``DELETE /api/telegram/account/`` — link status + unlink.
     *
     * ``enabled`` tells the frontend whether to show the Telegram card at all
     * (the channel is server-side opt-in via env vars).
     * @returns void
     * @throws ApiError
     */
    public static telegramAccountDestroy(): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/telegram/account/',
        });
    }
    /**
     * ``POST /api/telegram/link-token/`` — mint a deep-link for account linking.
     * @returns any No response body
     * @throws ApiError
     */
    public static telegramLinkTokenCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/telegram/link-token/',
        });
    }
}
