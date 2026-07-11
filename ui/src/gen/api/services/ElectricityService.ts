/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CircuitUsagePointLink } from '../models/CircuitUsagePointLink';
import type { ConsumptionImport } from '../models/ConsumptionImport';
import type { ElectricCircuit } from '../models/ElectricCircuit';
import type { ElectricityBoard } from '../models/ElectricityBoard';
import type { ElectricityMeter } from '../models/ElectricityMeter';
import type { MaintenanceEvent } from '../models/MaintenanceEvent';
import type { MeterReading } from '../models/MeterReading';
import type { MeterTariff } from '../models/MeterTariff';
import type { PatchedCircuitUsagePointLink } from '../models/PatchedCircuitUsagePointLink';
import type { PatchedElectricCircuit } from '../models/PatchedElectricCircuit';
import type { PatchedElectricityBoard } from '../models/PatchedElectricityBoard';
import type { PatchedElectricityMeter } from '../models/PatchedElectricityMeter';
import type { PatchedMaintenanceEvent } from '../models/PatchedMaintenanceEvent';
import type { PatchedMeterReading } from '../models/PatchedMeterReading';
import type { PatchedMeterTariff } from '../models/PatchedMeterTariff';
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
     * Consumption file imports — list history, upload, preview.
     *
     * ``POST`` always answers 201 with the import trace: a business failure
     * (unreadable file) is ``status='failed'`` on the object, not an API error —
     * and zero records are written in that case.
     * @returns ConsumptionImport
     * @throws ApiError
     */
    public static electricityConsumptionImportsList(): CancelablePromise<Array<ConsumptionImport>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/consumption/imports/',
        });
    }
    /**
     * Consumption file imports — list history, upload, preview.
     *
     * ``POST`` always answers 201 with the import trace: a business failure
     * (unreadable file) is ``status='failed'`` on the object, not an API error —
     * and zero records are written in that case.
     * @param requestBody
     * @returns ConsumptionImport
     * @throws ApiError
     */
    public static electricityConsumptionImportsCreate(
        requestBody?: ConsumptionImport,
    ): CancelablePromise<ConsumptionImport> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/consumption/imports/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Consumption file imports — list history, upload, preview.
     *
     * ``POST`` always answers 201 with the import trace: a business failure
     * (unreadable file) is ``status='failed'`` on the object, not an API error —
     * and zero records are written in that case.
     * @param id
     * @returns ConsumptionImport
     * @throws ApiError
     */
    public static electricityConsumptionImportsRetrieve(
        id: string,
    ): CancelablePromise<ConsumptionImport> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/consumption/imports/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Consumption file imports — list history, upload, preview.
     *
     * ``POST`` always answers 201 with the import trace: a business failure
     * (unreadable file) is ``status='failed'`` on the object, not an API error —
     * and zero records are written in that case.
     * @param requestBody
     * @returns ConsumptionImport
     * @throws ApiError
     */
    public static electricityConsumptionImportsPreviewCreate(
        requestBody?: ConsumptionImport,
    ): CancelablePromise<ConsumptionImport> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/consumption/imports/preview/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Server-side aggregation of consumption records by granularity.
     * @returns any No response body
     * @throws ApiError
     */
    public static electricityConsumptionSummaryRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/consumption/summary/',
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
     * Readings CRUD — every write regenerates the derived daily estimates.
     *
     * Validation lives in ``MeterReadingSerializer`` and the regeneration in
     * ``services.rebuild_reading_records`` — the same two pieces the agent's
     * write path (``services.create_meter_reading``) goes through.
     * @returns MeterReading
     * @throws ApiError
     */
    public static electricityMeterReadingsList(): CancelablePromise<Array<MeterReading>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/meter-readings/',
        });
    }
    /**
     * Readings CRUD — every write regenerates the derived daily estimates.
     *
     * Validation lives in ``MeterReadingSerializer`` and the regeneration in
     * ``services.rebuild_reading_records`` — the same two pieces the agent's
     * write path (``services.create_meter_reading``) goes through.
     * @param requestBody
     * @returns MeterReading
     * @throws ApiError
     */
    public static electricityMeterReadingsCreate(
        requestBody: MeterReading,
    ): CancelablePromise<MeterReading> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/meter-readings/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Readings CRUD — every write regenerates the derived daily estimates.
     *
     * Validation lives in ``MeterReadingSerializer`` and the regeneration in
     * ``services.rebuild_reading_records`` — the same two pieces the agent's
     * write path (``services.create_meter_reading``) goes through.
     * @param id
     * @returns MeterReading
     * @throws ApiError
     */
    public static electricityMeterReadingsRetrieve(
        id: string,
    ): CancelablePromise<MeterReading> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/meter-readings/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Readings CRUD — every write regenerates the derived daily estimates.
     *
     * Validation lives in ``MeterReadingSerializer`` and the regeneration in
     * ``services.rebuild_reading_records`` — the same two pieces the agent's
     * write path (``services.create_meter_reading``) goes through.
     * @param id
     * @param requestBody
     * @returns MeterReading
     * @throws ApiError
     */
    public static electricityMeterReadingsUpdate(
        id: string,
        requestBody: MeterReading,
    ): CancelablePromise<MeterReading> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/meter-readings/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Readings CRUD — every write regenerates the derived daily estimates.
     *
     * Validation lives in ``MeterReadingSerializer`` and the regeneration in
     * ``services.rebuild_reading_records`` — the same two pieces the agent's
     * write path (``services.create_meter_reading``) goes through.
     * @param id
     * @param requestBody
     * @returns MeterReading
     * @throws ApiError
     */
    public static electricityMeterReadingsPartialUpdate(
        id: string,
        requestBody?: PatchedMeterReading,
    ): CancelablePromise<MeterReading> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/meter-readings/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Readings CRUD — every write regenerates the derived daily estimates.
     *
     * Validation lives in ``MeterReadingSerializer`` and the regeneration in
     * ``services.rebuild_reading_records`` — the same two pieces the agent's
     * write path (``services.create_meter_reading``) goes through.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static electricityMeterReadingsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/meter-readings/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Pricing periods CRUD — validation (register/tariff_type coherence,
     * unique start date) lives in ``MeterTariffSerializer``.
     * @returns MeterTariff
     * @throws ApiError
     */
    public static electricityMeterTariffsList(): CancelablePromise<Array<MeterTariff>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/meter-tariffs/',
        });
    }
    /**
     * Pricing periods CRUD — validation (register/tariff_type coherence,
     * unique start date) lives in ``MeterTariffSerializer``.
     * @param requestBody
     * @returns MeterTariff
     * @throws ApiError
     */
    public static electricityMeterTariffsCreate(
        requestBody: MeterTariff,
    ): CancelablePromise<MeterTariff> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/meter-tariffs/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Pricing periods CRUD — validation (register/tariff_type coherence,
     * unique start date) lives in ``MeterTariffSerializer``.
     * @param id
     * @returns MeterTariff
     * @throws ApiError
     */
    public static electricityMeterTariffsRetrieve(
        id: string,
    ): CancelablePromise<MeterTariff> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/meter-tariffs/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Pricing periods CRUD — validation (register/tariff_type coherence,
     * unique start date) lives in ``MeterTariffSerializer``.
     * @param id
     * @param requestBody
     * @returns MeterTariff
     * @throws ApiError
     */
    public static electricityMeterTariffsUpdate(
        id: string,
        requestBody: MeterTariff,
    ): CancelablePromise<MeterTariff> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/meter-tariffs/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Pricing periods CRUD — validation (register/tariff_type coherence,
     * unique start date) lives in ``MeterTariffSerializer``.
     * @param id
     * @param requestBody
     * @returns MeterTariff
     * @throws ApiError
     */
    public static electricityMeterTariffsPartialUpdate(
        id: string,
        requestBody?: PatchedMeterTariff,
    ): CancelablePromise<MeterTariff> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/meter-tariffs/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Pricing periods CRUD — validation (register/tariff_type coherence,
     * unique start date) lives in ``MeterTariffSerializer``.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static electricityMeterTariffsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/meter-tariffs/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns ElectricityMeter
     * @throws ApiError
     */
    public static electricityMetersList(): CancelablePromise<Array<ElectricityMeter>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/meters/',
        });
    }
    /**
     * @param requestBody
     * @returns ElectricityMeter
     * @throws ApiError
     */
    public static electricityMetersCreate(
        requestBody: ElectricityMeter,
    ): CancelablePromise<ElectricityMeter> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/electricity/meters/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ElectricityMeter
     * @throws ApiError
     */
    public static electricityMetersRetrieve(
        id: string,
    ): CancelablePromise<ElectricityMeter> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/electricity/meters/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ElectricityMeter
     * @throws ApiError
     */
    public static electricityMetersUpdate(
        id: string,
        requestBody: ElectricityMeter,
    ): CancelablePromise<ElectricityMeter> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/electricity/meters/{id}/',
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
     * @returns ElectricityMeter
     * @throws ApiError
     */
    public static electricityMetersPartialUpdate(
        id: string,
        requestBody?: PatchedElectricityMeter,
    ): CancelablePromise<ElectricityMeter> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/electricity/meters/{id}/',
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
    public static electricityMetersDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/electricity/meters/{id}/',
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
