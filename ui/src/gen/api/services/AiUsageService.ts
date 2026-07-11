/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AiUsageService {
    /**
     * ``GET /api/ai-usage/{summary,histogram,recent}/`` — household owners only.
     *
     * Read-only observability over ``AIUsageLog``. The household is resolved like
     * everywhere else (header/query/active household); ownership is enforced
     * explicitly — a plain member gets a 403, whatever the endpoint.
     * @returns any No response body
     * @throws ApiError
     */
    public static aiUsageHistogramRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ai-usage/histogram/',
        });
    }
    /**
     * ``GET /api/ai-usage/{summary,histogram,recent}/`` — household owners only.
     *
     * Read-only observability over ``AIUsageLog``. The household is resolved like
     * everywhere else (header/query/active household); ownership is enforced
     * explicitly — a plain member gets a 403, whatever the endpoint.
     * @returns any No response body
     * @throws ApiError
     */
    public static aiUsageRecentRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ai-usage/recent/',
        });
    }
    /**
     * ``GET /api/ai-usage/{summary,histogram,recent}/`` — household owners only.
     *
     * Read-only observability over ``AIUsageLog``. The household is resolved like
     * everywhere else (header/query/active household); ownership is enforced
     * explicitly — a plain member gets a 403, whatever the endpoint.
     * @returns any No response body
     * @throws ApiError
     */
    public static aiUsageSummaryRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/ai-usage/summary/',
        });
    }
}
