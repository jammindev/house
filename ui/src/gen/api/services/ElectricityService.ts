/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CircuitUsagePointLink } from '../models/CircuitUsagePointLink';
import type { ElectricCircuit } from '../models/ElectricCircuit';
import type { ElectricityBoard } from '../models/ElectricityBoard';
import type { MaintenanceEvent } from '../models/MaintenanceEvent';
import type { PatchedCircuitUsagePointLink } from '../models/PatchedCircuitUsagePointLink';
import type { PatchedElectricCircuit } from '../models/PatchedElectricCircuit';
import type { PatchedElectricityBoard } from '../models/PatchedElectricityBoard';
import type { PatchedMaintenanceEvent } from '../models/PatchedMaintenanceEvent';
import type { PatchedProtectiveDevice } from '../models/PatchedProtectiveDevice';
import type { PatchedUsagePoint } from '../models/PatchedUsagePoint';
import type { PlanChangeLog } from '../models/PlanChangeLog';
import type { ProtectiveDevice } from '../models/ProtectiveDevice';
import type { UsagePoint } from '../models/UsagePoint';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ElectricityService {
    /**
     * @returns ElectricityBoard
     * @throws ApiError
     */
    public static electricityBoardsList(): CancelablePromise<Array<ElectricityBoard>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/boards/',
        });
    }
    /**
     * @param requestBody
     * @returns ElectricityBoard
     * @throws ApiError
     */
    public static electricityBoardsCreate(
        requestBody: ElectricityBoard,
    ): CancelablePromise<ElectricityBoard> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/boards/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ElectricityBoard
     * @throws ApiError
     */
    public static electricityBoardsRetrieve(
        id: string,
    ): CancelablePromise<ElectricityBoard> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/boards/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ElectricityBoard
     * @throws ApiError
     */
    public static electricityBoardsUpdate(
        id: string,
        requestBody: ElectricityBoard,
    ): CancelablePromise<ElectricityBoard> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/boards/{id}/',
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
     * @returns ElectricityBoard
     * @throws ApiError
     */
    public static electricityBoardsPartialUpdate(
        id: string,
        requestBody?: PatchedElectricityBoard,
    ): CancelablePromise<ElectricityBoard> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/boards/{id}/',
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
    public static electricityBoardsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/boards/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns PlanChangeLog
     * @throws ApiError
     */
    public static electricityChangeLogsList(): CancelablePromise<Array<PlanChangeLog>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/change-logs/',
        });
    }
    /**
     * @param id
     * @returns PlanChangeLog
     * @throws ApiError
     */
    public static electricityChangeLogsRetrieve(
        id: string,
    ): CancelablePromise<PlanChangeLog> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/change-logs/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns ElectricCircuit
     * @throws ApiError
     */
    public static electricityCircuitsList(): CancelablePromise<Array<ElectricCircuit>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/circuits/',
        });
    }
    /**
     * @param requestBody
     * @returns ElectricCircuit
     * @throws ApiError
     */
    public static electricityCircuitsCreate(
        requestBody: ElectricCircuit,
    ): CancelablePromise<ElectricCircuit> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/circuits/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ElectricCircuit
     * @throws ApiError
     */
    public static electricityCircuitsRetrieve(
        id: string,
    ): CancelablePromise<ElectricCircuit> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/circuits/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ElectricCircuit
     * @throws ApiError
     */
    public static electricityCircuitsUpdate(
        id: string,
        requestBody: ElectricCircuit,
    ): CancelablePromise<ElectricCircuit> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/circuits/{id}/',
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
     * @returns ElectricCircuit
     * @throws ApiError
     */
    public static electricityCircuitsPartialUpdate(
        id: string,
        requestBody?: PatchedElectricCircuit,
    ): CancelablePromise<ElectricCircuit> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/circuits/{id}/',
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
    public static electricityCircuitsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/circuits/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns CircuitUsagePointLink
     * @throws ApiError
     */
    public static electricityLinksList(): CancelablePromise<Array<CircuitUsagePointLink>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/links/',
        });
    }
    /**
     * @param requestBody
     * @returns CircuitUsagePointLink
     * @throws ApiError
     */
    public static electricityLinksCreate(
        requestBody: CircuitUsagePointLink,
    ): CancelablePromise<CircuitUsagePointLink> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/links/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns CircuitUsagePointLink
     * @throws ApiError
     */
    public static electricityLinksRetrieve(
        id: string,
    ): CancelablePromise<CircuitUsagePointLink> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/links/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns CircuitUsagePointLink
     * @throws ApiError
     */
    public static electricityLinksUpdate(
        id: string,
        requestBody: CircuitUsagePointLink,
    ): CancelablePromise<CircuitUsagePointLink> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/links/{id}/',
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
     * @returns CircuitUsagePointLink
     * @throws ApiError
     */
    public static electricityLinksPartialUpdate(
        id: string,
        requestBody?: PatchedCircuitUsagePointLink,
    ): CancelablePromise<CircuitUsagePointLink> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/links/{id}/',
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
    public static electricityLinksDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/links/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns CircuitUsagePointLink
     * @throws ApiError
     */
    public static electricityLinksDeactivateCreate(
        id: string,
        requestBody: CircuitUsagePointLink,
    ): CancelablePromise<CircuitUsagePointLink> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/links/{id}/deactivate/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @returns MaintenanceEvent
     * @throws ApiError
     */
    public static electricityMaintenanceEventsList(): CancelablePromise<Array<MaintenanceEvent>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/maintenance-events/',
        });
    }
    /**
     * @param requestBody
     * @returns MaintenanceEvent
     * @throws ApiError
     */
    public static electricityMaintenanceEventsCreate(
        requestBody: MaintenanceEvent,
    ): CancelablePromise<MaintenanceEvent> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/maintenance-events/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns MaintenanceEvent
     * @throws ApiError
     */
    public static electricityMaintenanceEventsRetrieve(
        id: string,
    ): CancelablePromise<MaintenanceEvent> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/maintenance-events/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns MaintenanceEvent
     * @throws ApiError
     */
    public static electricityMaintenanceEventsUpdate(
        id: string,
        requestBody: MaintenanceEvent,
    ): CancelablePromise<MaintenanceEvent> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/maintenance-events/{id}/',
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
     * @returns MaintenanceEvent
     * @throws ApiError
     */
    public static electricityMaintenanceEventsPartialUpdate(
        id: string,
        requestBody?: PatchedMaintenanceEvent,
    ): CancelablePromise<MaintenanceEvent> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/maintenance-events/{id}/',
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
    public static electricityMaintenanceEventsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/maintenance-events/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns ProtectiveDevice
     * @throws ApiError
     */
    public static electricityProtectiveDevicesList(): CancelablePromise<Array<ProtectiveDevice>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/protective-devices/',
        });
    }
    /**
     * @param requestBody
     * @returns ProtectiveDevice
     * @throws ApiError
     */
    public static electricityProtectiveDevicesCreate(
        requestBody: ProtectiveDevice,
    ): CancelablePromise<ProtectiveDevice> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/protective-devices/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ProtectiveDevice
     * @throws ApiError
     */
    public static electricityProtectiveDevicesRetrieve(
        id: string,
    ): CancelablePromise<ProtectiveDevice> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/protective-devices/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ProtectiveDevice
     * @throws ApiError
     */
    public static electricityProtectiveDevicesUpdate(
        id: string,
        requestBody: ProtectiveDevice,
    ): CancelablePromise<ProtectiveDevice> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/protective-devices/{id}/',
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
     * @returns ProtectiveDevice
     * @throws ApiError
     */
    public static electricityProtectiveDevicesPartialUpdate(
        id: string,
        requestBody?: PatchedProtectiveDevice,
    ): CancelablePromise<ProtectiveDevice> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/protective-devices/{id}/',
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
    public static electricityProtectiveDevicesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/protective-devices/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns UsagePoint
     * @throws ApiError
     */
    public static electricityUsagePointsList(): CancelablePromise<Array<UsagePoint>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/usage-points/',
        });
    }
    /**
     * @param requestBody
     * @returns UsagePoint
     * @throws ApiError
     */
    public static electricityUsagePointsCreate(
        requestBody: UsagePoint,
    ): CancelablePromise<UsagePoint> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/usage-points/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns UsagePoint
     * @throws ApiError
     */
    public static electricityUsagePointsRetrieve(
        id: string,
    ): CancelablePromise<UsagePoint> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/usage-points/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns UsagePoint
     * @throws ApiError
     */
    public static electricityUsagePointsUpdate(
        id: string,
        requestBody: UsagePoint,
    ): CancelablePromise<UsagePoint> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/usage-points/{id}/',
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
     * @returns UsagePoint
     * @throws ApiError
     */
    public static electricityUsagePointsPartialUpdate(
        id: string,
        requestBody?: PatchedUsagePoint,
    ): CancelablePromise<UsagePoint> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/usage-points/{id}/',
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
    public static electricityUsagePointsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/usage-points/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param requestBody
     * @returns UsagePoint
     * @throws ApiError
     */
    public static electricityUsagePointsBulkCreateCreate(
        requestBody: UsagePoint,
    ): CancelablePromise<UsagePoint> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/usage-points/bulk-create/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
