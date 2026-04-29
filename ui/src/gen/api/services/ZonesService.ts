/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedZone } from '../models/PatchedZone';
import type { Zone } from '../models/Zone';
import type { ZoneTree } from '../models/ZoneTree';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ZonesService {
    /**
     * ViewSet for zone CRUD operations.
     *
     * List: Returns zones for user's households (flat or tree)
     * Create: Creates new zone
     * Retrieve: Gets zone details
     * Update: Updates zone
     * Delete: Deletes zone (cascades to children)
     * @returns Zone
     * @throws ApiError
     */
    public static zonesList(): CancelablePromise<Array<Zone>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/zones/',
        });
    }
    /**
     * ViewSet for zone CRUD operations.
     *
     * List: Returns zones for user's households (flat or tree)
     * Create: Creates new zone
     * Retrieve: Gets zone details
     * Update: Updates zone
     * Delete: Deletes zone (cascades to children)
     * @param requestBody
     * @returns Zone
     * @throws ApiError
     */
    public static zonesCreate(
        requestBody: Zone,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/zones/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * ViewSet for zone CRUD operations.
     *
     * List: Returns zones for user's households (flat or tree)
     * Create: Creates new zone
     * Retrieve: Gets zone details
     * Update: Updates zone
     * Delete: Deletes zone (cascades to children)
     * @param id A UUID string identifying this zone.
     * @returns Zone
     * @throws ApiError
     */
    public static zonesRetrieve(
        id: string,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/zones/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Reject stale writes when last_known_updated_at is provided.
     * @param id A UUID string identifying this zone.
     * @param requestBody
     * @returns Zone
     * @throws ApiError
     */
    public static zonesUpdate(
        id: string,
        requestBody: Zone,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/zones/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Reject stale writes when last_known_updated_at is provided.
     * @param id A UUID string identifying this zone.
     * @param requestBody
     * @returns Zone
     * @throws ApiError
     */
    public static zonesPartialUpdate(
        id: string,
        requestBody?: PatchedZone,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/zones/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Block deletion when zone still has children.
     * @param id A UUID string identifying this zone.
     * @returns void
     * @throws ApiError
     */
    public static zonesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/zones/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Attach a photo document to this zone.
     * @param id A UUID string identifying this zone.
     * @param requestBody
     * @returns Zone
     * @throws ApiError
     */
    public static zonesAttachPhotoCreate(
        id: string,
        requestBody: Zone,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/zones/{id}/attach_photo/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get direct children of a zone.
     * @param id A UUID string identifying this zone.
     * @returns Zone
     * @throws ApiError
     */
    public static zonesChildrenRetrieve(
        id: string,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/zones/{id}/children/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Get photos linked to this zone.
     * @param id A UUID string identifying this zone.
     * @returns Zone
     * @throws ApiError
     */
    public static zonesPhotosRetrieve(
        id: string,
    ): CancelablePromise<Zone> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/zones/{id}/photos/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Get zones as hierarchical tree.
     * Returns only root zones with nested children.
     * @returns ZoneTree
     * @throws ApiError
     */
    public static zonesTreeRetrieve(): CancelablePromise<ZoneTree> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/zones/tree/',
        });
    }
}
