/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedStructure } from '../models/PatchedStructure';
import type { Structure } from '../models/Structure';
import type { StructureNested } from '../models/StructureNested';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class StructuresService {
    /**
     * @returns StructureNested
     * @throws ApiError
     */
    public static structuresList(): CancelablePromise<Array<StructureNested>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/structures/',
        });
    }
    /**
     * @param requestBody
     * @returns Structure
     * @throws ApiError
     */
    public static structuresCreate(
        requestBody?: Structure,
    ): CancelablePromise<Structure> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/structures/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns StructureNested
     * @throws ApiError
     */
    public static structuresRetrieve(
        id: string,
    ): CancelablePromise<StructureNested> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/structures/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns Structure
     * @throws ApiError
     */
    public static structuresUpdate(
        id: string,
        requestBody?: Structure,
    ): CancelablePromise<Structure> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/structures/{id}/',
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
     * @returns Structure
     * @throws ApiError
     */
    public static structuresPartialUpdate(
        id: string,
        requestBody?: PatchedStructure,
    ): CancelablePromise<Structure> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/structures/{id}/',
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
    public static structuresDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/structures/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
