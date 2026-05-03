/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Equipment } from '../models/Equipment';
import type { EquipmentInteraction } from '../models/EquipmentInteraction';
import type { PatchedEquipment } from '../models/PatchedEquipment';
import type { PatchedEquipmentInteraction } from '../models/PatchedEquipmentInteraction';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class EquipmentService {
    /**
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentList(
        ordering?: string,
        search?: string,
    ): CancelablePromise<Array<Equipment>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/equipment/',
            query: {
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * @param requestBody
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentCreate(
        requestBody: Equipment,
    ): CancelablePromise<Equipment> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/equipment/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentRetrieve(
        id: string,
    ): CancelablePromise<Equipment> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/equipment/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentUpdate(
        id: string,
        requestBody: Equipment,
    ): CancelablePromise<Equipment> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/equipment/{id}/',
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
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentPartialUpdate(
        id: string,
        requestBody?: PatchedEquipment,
    ): CancelablePromise<Equipment> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/equipment/{id}/',
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
    public static equipmentDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/equipment/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentAuditRetrieve(
        id: string,
    ): CancelablePromise<Equipment> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/equipment/{id}/audit/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Snapshot purchase fields on the equipment + create an expense Interaction.
     *
     * Single-action endpoint: writes amount/supplier/date on the equipment AND
     * creates an Interaction(type=expense) linked via the polymorphic source FK.
     * @param id
     * @param requestBody
     * @returns Equipment
     * @throws ApiError
     */
    public static equipmentRegisterPurchaseCreate(
        id: string,
        requestBody: Equipment,
    ): CancelablePromise<Equipment> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/equipment/{id}/register-purchase/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param ordering Which field to use when ordering the results.
     * @returns EquipmentInteraction
     * @throws ApiError
     */
    public static equipmentEquipmentInteractionsList(
        ordering?: string,
    ): CancelablePromise<Array<EquipmentInteraction>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/equipment/equipment-interactions/',
            query: {
                'ordering': ordering,
            },
        });
    }
    /**
     * @param requestBody
     * @returns EquipmentInteraction
     * @throws ApiError
     */
    public static equipmentEquipmentInteractionsCreate(
        requestBody: EquipmentInteraction,
    ): CancelablePromise<EquipmentInteraction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/equipment/equipment-interactions/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns EquipmentInteraction
     * @throws ApiError
     */
    public static equipmentEquipmentInteractionsRetrieve(
        id: string,
    ): CancelablePromise<EquipmentInteraction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/equipment/equipment-interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns EquipmentInteraction
     * @throws ApiError
     */
    public static equipmentEquipmentInteractionsUpdate(
        id: string,
        requestBody: EquipmentInteraction,
    ): CancelablePromise<EquipmentInteraction> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/equipment/equipment-interactions/{id}/',
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
     * @returns EquipmentInteraction
     * @throws ApiError
     */
    public static equipmentEquipmentInteractionsPartialUpdate(
        id: string,
        requestBody?: PatchedEquipmentInteraction,
    ): CancelablePromise<EquipmentInteraction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/equipment/equipment-interactions/{id}/',
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
    public static equipmentEquipmentInteractionsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/equipment/equipment-interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
