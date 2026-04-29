/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InsuranceContract } from '../models/InsuranceContract';
import type { PatchedInsuranceContract } from '../models/PatchedInsuranceContract';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class InsuranceService {
    /**
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns InsuranceContract
     * @throws ApiError
     */
    public static insuranceList(
        ordering?: string,
        search?: string,
    ): CancelablePromise<Array<InsuranceContract>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/insurance/',
            query: {
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * @param requestBody
     * @returns InsuranceContract
     * @throws ApiError
     */
    public static insuranceCreate(
        requestBody: InsuranceContract,
    ): CancelablePromise<InsuranceContract> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/insurance/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InsuranceContract
     * @throws ApiError
     */
    public static insuranceRetrieve(
        id: string,
    ): CancelablePromise<InsuranceContract> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/insurance/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InsuranceContract
     * @throws ApiError
     */
    public static insuranceUpdate(
        id: string,
        requestBody: InsuranceContract,
    ): CancelablePromise<InsuranceContract> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/insurance/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InsuranceContract
     * @throws ApiError
     */
    public static insurancePartialUpdate(
        id: string,
        requestBody?: PatchedInsuranceContract,
    ): CancelablePromise<InsuranceContract> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/insurance/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static insuranceDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/insurance/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
