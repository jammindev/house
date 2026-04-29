/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedProject } from '../models/PatchedProject';
import type { PatchedProjectAIMessage } from '../models/PatchedProjectAIMessage';
import type { PatchedProjectAIThread } from '../models/PatchedProjectAIThread';
import type { PatchedProjectGroup } from '../models/PatchedProjectGroup';
import type { PatchedProjectZone } from '../models/PatchedProjectZone';
import type { Project } from '../models/Project';
import type { ProjectAIMessage } from '../models/ProjectAIMessage';
import type { ProjectAIThread } from '../models/ProjectAIThread';
import type { ProjectGroup } from '../models/ProjectGroup';
import type { ProjectZone } from '../models/ProjectZone';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProjectsService {
    /**
     * @returns ProjectAIMessage
     * @throws ApiError
     */
    public static projectsProjectAiMessagesList(): CancelablePromise<Array<ProjectAIMessage>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-ai-messages/',
        });
    }
    /**
     * @param requestBody
     * @returns ProjectAIMessage
     * @throws ApiError
     */
    public static projectsProjectAiMessagesCreate(
        requestBody: ProjectAIMessage,
    ): CancelablePromise<ProjectAIMessage> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/project-ai-messages/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ProjectAIMessage
     * @throws ApiError
     */
    public static projectsProjectAiMessagesRetrieve(
        id: string,
    ): CancelablePromise<ProjectAIMessage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-ai-messages/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ProjectAIMessage
     * @throws ApiError
     */
    public static projectsProjectAiMessagesUpdate(
        id: string,
        requestBody: ProjectAIMessage,
    ): CancelablePromise<ProjectAIMessage> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/projects/project-ai-messages/{id}/',
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
     * @returns ProjectAIMessage
     * @throws ApiError
     */
    public static projectsProjectAiMessagesPartialUpdate(
        id: string,
        requestBody?: PatchedProjectAIMessage,
    ): CancelablePromise<ProjectAIMessage> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/project-ai-messages/{id}/',
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
    public static projectsProjectAiMessagesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/project-ai-messages/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns ProjectAIThread
     * @throws ApiError
     */
    public static projectsProjectAiThreadsList(): CancelablePromise<Array<ProjectAIThread>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-ai-threads/',
        });
    }
    /**
     * @param requestBody
     * @returns ProjectAIThread
     * @throws ApiError
     */
    public static projectsProjectAiThreadsCreate(
        requestBody: ProjectAIThread,
    ): CancelablePromise<ProjectAIThread> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/project-ai-threads/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ProjectAIThread
     * @throws ApiError
     */
    public static projectsProjectAiThreadsRetrieve(
        id: string,
    ): CancelablePromise<ProjectAIThread> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-ai-threads/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ProjectAIThread
     * @throws ApiError
     */
    public static projectsProjectAiThreadsUpdate(
        id: string,
        requestBody: ProjectAIThread,
    ): CancelablePromise<ProjectAIThread> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/projects/project-ai-threads/{id}/',
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
     * @returns ProjectAIThread
     * @throws ApiError
     */
    public static projectsProjectAiThreadsPartialUpdate(
        id: string,
        requestBody?: PatchedProjectAIThread,
    ): CancelablePromise<ProjectAIThread> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/project-ai-threads/{id}/',
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
    public static projectsProjectAiThreadsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/project-ai-threads/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns ProjectGroup
     * @throws ApiError
     */
    public static projectsProjectGroupsList(): CancelablePromise<Array<ProjectGroup>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-groups/',
        });
    }
    /**
     * @param requestBody
     * @returns ProjectGroup
     * @throws ApiError
     */
    public static projectsProjectGroupsCreate(
        requestBody: ProjectGroup,
    ): CancelablePromise<ProjectGroup> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/project-groups/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ProjectGroup
     * @throws ApiError
     */
    public static projectsProjectGroupsRetrieve(
        id: string,
    ): CancelablePromise<ProjectGroup> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-groups/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ProjectGroup
     * @throws ApiError
     */
    public static projectsProjectGroupsUpdate(
        id: string,
        requestBody: ProjectGroup,
    ): CancelablePromise<ProjectGroup> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/projects/project-groups/{id}/',
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
     * @returns ProjectGroup
     * @throws ApiError
     */
    public static projectsProjectGroupsPartialUpdate(
        id: string,
        requestBody?: PatchedProjectGroup,
    ): CancelablePromise<ProjectGroup> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/project-groups/{id}/',
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
    public static projectsProjectGroupsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/project-groups/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns ProjectZone
     * @throws ApiError
     */
    public static projectsProjectZonesList(): CancelablePromise<Array<ProjectZone>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-zones/',
        });
    }
    /**
     * @param requestBody
     * @returns ProjectZone
     * @throws ApiError
     */
    public static projectsProjectZonesCreate(
        requestBody: ProjectZone,
    ): CancelablePromise<ProjectZone> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/project-zones/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns ProjectZone
     * @throws ApiError
     */
    public static projectsProjectZonesRetrieve(
        id: string,
    ): CancelablePromise<ProjectZone> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/project-zones/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns ProjectZone
     * @throws ApiError
     */
    public static projectsProjectZonesUpdate(
        id: string,
        requestBody: ProjectZone,
    ): CancelablePromise<ProjectZone> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/projects/project-zones/{id}/',
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
     * @returns ProjectZone
     * @throws ApiError
     */
    public static projectsProjectZonesPartialUpdate(
        id: string,
        requestBody?: PatchedProjectZone,
    ): CancelablePromise<ProjectZone> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/project-zones/{id}/',
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
    public static projectsProjectZonesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/project-zones/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsList(): CancelablePromise<Array<Project>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/projects/',
        });
    }
    /**
     * @param requestBody
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsCreate(
        requestBody: Project,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/projects/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsRetrieve(
        id: string,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/projects/projects/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsUpdate(
        id: string,
        requestBody: Project,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/projects/projects/{id}/',
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
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsPartialUpdate(
        id: string,
        requestBody?: PatchedProject,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/projects/projects/{id}/',
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
    public static projectsProjectsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/projects/projects/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsAttachDocumentCreate(
        id: string,
        requestBody: Project,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/projects/{id}/attach_document/',
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
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsDetachDocumentCreate(
        id: string,
        requestBody: Project,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/projects/{id}/detach_document/',
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
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsPinCreate(
        id: string,
        requestBody: Project,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/projects/{id}/pin/',
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
     * @returns Project
     * @throws ApiError
     */
    public static projectsProjectsUnpinCreate(
        id: string,
        requestBody: Project,
    ): CancelablePromise<Project> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/projects/projects/{id}/unpin/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
