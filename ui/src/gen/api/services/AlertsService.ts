/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AlertsService {
    /**
     * GET /api/alerts/summary/ — overdue tasks, expiring warranties, due maintenances.
     * @returns any No response body
     * @throws ApiError
     */
    public static alertsSummaryRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/alerts/summary/',
        });
    }
}
