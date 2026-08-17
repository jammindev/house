/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SearchService {
    /**
     * ``GET /api/search/?q=&limit=&semantic=`` — search everything the household owns.
     *
     * Same URL for both stages so the client has one contract and one payload shape;
     * ``semantic=1`` is what changes which leg runs. Both answer ``{"results": [...]}``,
     * and an empty list is always a valid answer — never an error.
     * @returns any No response body
     * @throws ApiError
     */
    public static searchRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/search/',
        });
    }
}
