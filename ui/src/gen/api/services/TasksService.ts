/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PaginatedTaskList } from '../models/PaginatedTaskList';
import type { PatchedTask } from '../models/PatchedTask';
import type { PatchedTaskDocumentLink } from '../models/PatchedTaskDocumentLink';
import type { PatchedTaskInteractionLink } from '../models/PatchedTaskInteractionLink';
import type { Task } from '../models/Task';
import type { TaskDocumentLink } from '../models/TaskDocumentLink';
import type { TaskInteractionLink } from '../models/TaskInteractionLink';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TasksService {
    /**
     * CRUD for Task↔Document links.
     * @returns TaskDocumentLink
     * @throws ApiError
     */
    public static tasksTaskDocumentsList(): CancelablePromise<Array<TaskDocumentLink>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/task-documents/',
        });
    }
    /**
     * CRUD for Task↔Document links.
     * @param requestBody
     * @returns TaskDocumentLink
     * @throws ApiError
     */
    public static tasksTaskDocumentsCreate(
        requestBody: TaskDocumentLink,
    ): CancelablePromise<TaskDocumentLink> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/task-documents/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for Task↔Document links.
     * @param id
     * @returns TaskDocumentLink
     * @throws ApiError
     */
    public static tasksTaskDocumentsRetrieve(
        id: string,
    ): CancelablePromise<TaskDocumentLink> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/task-documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for Task↔Document links.
     * @param id
     * @param requestBody
     * @returns TaskDocumentLink
     * @throws ApiError
     */
    public static tasksTaskDocumentsUpdate(
        id: string,
        requestBody: TaskDocumentLink,
    ): CancelablePromise<TaskDocumentLink> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tasks/task-documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for Task↔Document links.
     * @param id
     * @param requestBody
     * @returns TaskDocumentLink
     * @throws ApiError
     */
    public static tasksTaskDocumentsPartialUpdate(
        id: string,
        requestBody?: PatchedTaskDocumentLink,
    ): CancelablePromise<TaskDocumentLink> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tasks/task-documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for Task↔Document links.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static tasksTaskDocumentsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tasks/task-documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for Task↔Interaction links.
     * @returns TaskInteractionLink
     * @throws ApiError
     */
    public static tasksTaskInteractionsList(): CancelablePromise<Array<TaskInteractionLink>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/task-interactions/',
        });
    }
    /**
     * CRUD for Task↔Interaction links.
     * @param requestBody
     * @returns TaskInteractionLink
     * @throws ApiError
     */
    public static tasksTaskInteractionsCreate(
        requestBody: TaskInteractionLink,
    ): CancelablePromise<TaskInteractionLink> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/task-interactions/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for Task↔Interaction links.
     * @param id
     * @returns TaskInteractionLink
     * @throws ApiError
     */
    public static tasksTaskInteractionsRetrieve(
        id: string,
    ): CancelablePromise<TaskInteractionLink> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/task-interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD for Task↔Interaction links.
     * @param id
     * @param requestBody
     * @returns TaskInteractionLink
     * @throws ApiError
     */
    public static tasksTaskInteractionsUpdate(
        id: string,
        requestBody: TaskInteractionLink,
    ): CancelablePromise<TaskInteractionLink> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tasks/task-interactions/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for Task↔Interaction links.
     * @param id
     * @param requestBody
     * @returns TaskInteractionLink
     * @throws ApiError
     */
    public static tasksTaskInteractionsPartialUpdate(
        id: string,
        requestBody?: PatchedTaskInteractionLink,
    ): CancelablePromise<TaskInteractionLink> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tasks/task-interactions/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD for Task↔Interaction links.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static tasksTaskInteractionsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tasks/task-interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
     * completed_by and completed_at are auto-managed on status transitions.
     * @param limit Number of results to return per page.
     * @param offset The initial index from which to return the results.
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns PaginatedTaskList
     * @throws ApiError
     */
    public static tasksTasksList(
        limit?: number,
        offset?: number,
        ordering?: string,
        search?: string,
    ): CancelablePromise<PaginatedTaskList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/tasks/',
            query: {
                'limit': limit,
                'offset': offset,
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
     * completed_by and completed_at are auto-managed on status transitions.
     * @param requestBody
     * @returns Task
     * @throws ApiError
     */
    public static tasksTasksCreate(
        requestBody: Task,
    ): CancelablePromise<Task> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tasks/tasks/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
     * completed_by and completed_at are auto-managed on status transitions.
     * @param id
     * @returns Task
     * @throws ApiError
     */
    public static tasksTasksRetrieve(
        id: string,
    ): CancelablePromise<Task> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tasks/tasks/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
     * completed_by and completed_at are auto-managed on status transitions.
     * @param id
     * @param requestBody
     * @returns Task
     * @throws ApiError
     */
    public static tasksTasksUpdate(
        id: string,
        requestBody: Task,
    ): CancelablePromise<Task> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tasks/tasks/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
     * completed_by and completed_at are auto-managed on status transitions.
     * @param id
     * @param requestBody
     * @returns Task
     * @throws ApiError
     */
    public static tasksTasksPartialUpdate(
        id: string,
        requestBody?: PatchedTask,
    ): CancelablePromise<Task> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tasks/tasks/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Task CRUD with filtering by status, priority, zone, assigned_to, overdue.
     * completed_by and completed_at are auto-managed on status transitions.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static tasksTasksDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tasks/tasks/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
