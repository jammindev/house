/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Interaction } from '../models/Interaction';
import type { InteractionContact } from '../models/InteractionContact';
import type { InteractionCreateRequest } from '../models/InteractionCreateRequest';
import type { InteractionCreateResponse } from '../models/InteractionCreateResponse';
import type { InteractionDetail } from '../models/InteractionDetail';
import type { InteractionDocument } from '../models/InteractionDocument';
import type { InteractionDocumentCreate } from '../models/InteractionDocumentCreate';
import type { InteractionDocumentLink } from '../models/InteractionDocumentLink';
import type { InteractionStructure } from '../models/InteractionStructure';
import type { PaginatedInteractionList } from '../models/PaginatedInteractionList';
import type { PatchedInteraction } from '../models/PatchedInteraction';
import type { PatchedInteractionContact } from '../models/PatchedInteractionContact';
import type { PatchedInteractionDocument } from '../models/PatchedInteractionDocument';
import type { PatchedInteractionStructure } from '../models/PatchedInteractionStructure';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class InteractionsService {
    /**
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsList(): CancelablePromise<Array<InteractionContact>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-contacts/',
        });
    }
    /**
     * @param requestBody
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsCreate(
        requestBody: InteractionContact,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interaction-contacts/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsRetrieve(
        id: string,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-contacts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsUpdate(
        id: string,
        requestBody: InteractionContact,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interaction-contacts/{id}/',
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
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionContact,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interaction-contacts/{id}/',
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
    public static interactionsInteractionContactsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interaction-contacts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsList(): CancelablePromise<Array<InteractionDocument>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-documents/',
        });
    }
    /**
     * @param requestBody
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsCreate(
        requestBody: InteractionDocumentCreate,
    ): CancelablePromise<InteractionDocumentLink> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interaction-documents/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsRetrieve(
        id: string,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsUpdate(
        id: string,
        requestBody: InteractionDocument,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interaction-documents/{id}/',
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
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionDocument,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interaction-documents/{id}/',
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
    public static interactionsInteractionDocumentsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interaction-documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresList(): CancelablePromise<Array<InteractionStructure>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-structures/',
        });
    }
    /**
     * @param requestBody
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresCreate(
        requestBody: InteractionStructure,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interaction-structures/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresRetrieve(
        id: string,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-structures/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresUpdate(
        id: string,
        requestBody: InteractionStructure,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interaction-structures/{id}/',
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
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionStructure,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interaction-structures/{id}/',
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
    public static interactionsInteractionStructuresDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interaction-structures/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Interaction CRUD with filtering by type, status, tags, zones, dates.
     * @param createdBy
     * @param limit Number of results to return per page.
     * @param offset The initial index from which to return the results.
     * @param ordering Which field to use when ordering the results.
     * @param project
     * @param search A search term.
     * @param status Status (mainly for todos)
     *
     * * `backlog` - Backlog
     * * `pending` - Pending
     * * `in_progress` - In Progress
     * * `done` - Done
     * * `archived` - Archived
     * @param type * `note` - Note
     * * `todo` - Todo
     * * `expense` - Expense
     * * `maintenance` - Maintenance
     * * `repair` - Repair
     * * `installation` - Installation
     * * `inspection` - Inspection
     * * `warranty` - Warranty
     * * `issue` - Issue
     * * `upgrade` - Upgrade
     * * `replacement` - Replacement
     * * `disposal` - Disposal
     * @returns PaginatedInteractionList
     * @throws ApiError
     */
    public static interactionsInteractionsList(
        createdBy?: number,
        limit?: number,
        offset?: number,
        ordering?: string,
        project?: string,
        search?: string,
        status?: 'archived' | 'backlog' | 'done' | 'in_progress' | 'pending' | null,
        type?: 'disposal' | 'expense' | 'inspection' | 'installation' | 'issue' | 'maintenance' | 'note' | 'repair' | 'replacement' | 'todo' | 'upgrade' | 'warranty',
    ): CancelablePromise<PaginatedInteractionList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/',
            query: {
                'created_by': createdBy,
                'limit': limit,
                'offset': offset,
                'ordering': ordering,
                'project': project,
                'search': search,
                'status': status,
                'type': type,
            },
        });
    }
    /**
     * Interaction CRUD with filtering by type, status, tags, zones, dates.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsCreate(
        requestBody: InteractionCreateRequest,
    ): CancelablePromise<InteractionCreateResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interactions/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction CRUD with filtering by type, status, tags, zones, dates.
     * @param id A UUID string identifying this interaction.
     * @returns InteractionDetail
     * @throws ApiError
     */
    public static interactionsInteractionsRetrieve(
        id: string,
    ): CancelablePromise<InteractionDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Interaction CRUD with filtering by type, status, tags, zones, dates.
     * @param id A UUID string identifying this interaction.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsUpdate(
        id: string,
        requestBody: Interaction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction CRUD with filtering by type, status, tags, zones, dates.
     * @param id A UUID string identifying this interaction.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsPartialUpdate(
        id: string,
        requestBody?: PatchedInteraction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction CRUD with filtering by type, status, tags, zones, dates.
     * @param id A UUID string identifying this interaction.
     * @returns void
     * @throws ApiError
     */
    public static interactionsInteractionsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Quick status update for todos.
     * @param id A UUID string identifying this interaction.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsUpdateStatusPartialUpdate(
        id: string,
        requestBody?: PatchedInteraction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interactions/{id}/update_status/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Group interactions by type with counts.
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsByTypeRetrieve(): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/by_type/',
        });
    }
    /**
     * Get todos grouped by status for kanban board.
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsTasksRetrieve(): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/tasks/',
        });
    }
}
