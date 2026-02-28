/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InteractionTag } from '../models/InteractionTag';
import type { PatchedInteractionTag } from '../models/PatchedInteractionTag';
import type { PatchedTag } from '../models/PatchedTag';
import type { Tag } from '../models/Tag';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TagsService {
    /**
     * @returns InteractionTag
     * @throws ApiError
     */
    public static tagsInteractionTagsList(): CancelablePromise<Array<InteractionTag>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tags/interaction-tags/',
        });
    }
    /**
     * @param requestBody
     * @returns InteractionTag
     * @throws ApiError
     */
    public static tagsInteractionTagsCreate(
        requestBody: InteractionTag,
    ): CancelablePromise<InteractionTag> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tags/interaction-tags/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InteractionTag
     * @throws ApiError
     */
    public static tagsInteractionTagsRetrieve(
        id: string,
    ): CancelablePromise<InteractionTag> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tags/interaction-tags/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionTag
     * @throws ApiError
     */
    public static tagsInteractionTagsUpdate(
        id: string,
        requestBody: InteractionTag,
    ): CancelablePromise<InteractionTag> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tags/interaction-tags/{id}/',
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
     * @returns InteractionTag
     * @throws ApiError
     */
    public static tagsInteractionTagsPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionTag,
    ): CancelablePromise<InteractionTag> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tags/interaction-tags/{id}/',
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
    public static tagsInteractionTagsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tags/interaction-tags/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns Tag
     * @throws ApiError
     */
    public static tagsTagsList(): CancelablePromise<Array<Tag>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tags/tags/',
        });
    }
    /**
     * @param requestBody
     * @returns Tag
     * @throws ApiError
     */
    public static tagsTagsCreate(
        requestBody: Tag,
    ): CancelablePromise<Tag> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tags/tags/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this tag.
     * @returns Tag
     * @throws ApiError
     */
    public static tagsTagsRetrieve(
        id: string,
    ): CancelablePromise<Tag> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tags/tags/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id A UUID string identifying this tag.
     * @param requestBody
     * @returns Tag
     * @throws ApiError
     */
    public static tagsTagsUpdate(
        id: string,
        requestBody: Tag,
    ): CancelablePromise<Tag> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tags/tags/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this tag.
     * @param requestBody
     * @returns Tag
     * @throws ApiError
     */
    public static tagsTagsPartialUpdate(
        id: string,
        requestBody?: PatchedTag,
    ): CancelablePromise<Tag> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tags/tags/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this tag.
     * @returns void
     * @throws ApiError
     */
    public static tagsTagsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tags/tags/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
