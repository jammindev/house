/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedTag } from '../models/PatchedTag';
import type { PatchedTagLink } from '../models/PatchedTagLink';
import type { Tag } from '../models/Tag';
import type { TagLink } from '../models/TagLink';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TagsService {
    /**
     * @returns TagLink
     * @throws ApiError
     */
    public static tagsTagLinksList(): CancelablePromise<Array<TagLink>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tags/tag-links/',
        });
    }
    /**
     * @param requestBody
     * @returns TagLink
     * @throws ApiError
     */
    public static tagsTagLinksCreate(
        requestBody: TagLink,
    ): CancelablePromise<TagLink> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tags/tag-links/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns TagLink
     * @throws ApiError
     */
    public static tagsTagLinksRetrieve(
        id: string,
    ): CancelablePromise<TagLink> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tags/tag-links/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns TagLink
     * @throws ApiError
     */
    public static tagsTagLinksUpdate(
        id: string,
        requestBody: TagLink,
    ): CancelablePromise<TagLink> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/tags/tag-links/{id}/',
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
     * @returns TagLink
     * @throws ApiError
     */
    public static tagsTagLinksPartialUpdate(
        id: string,
        requestBody?: PatchedTagLink,
    ): CancelablePromise<TagLink> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/tags/tag-links/{id}/',
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
    public static tagsTagLinksDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/tags/tag-links/{id}/',
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
     * @param id
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
     * @param id
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
     * @param id
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
     * @param id
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
