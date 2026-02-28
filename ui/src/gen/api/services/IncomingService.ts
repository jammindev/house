/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IncomingEmail } from '../models/IncomingEmail';
import type { IncomingEmailAttachment } from '../models/IncomingEmailAttachment';
import type { PatchedIncomingEmail } from '../models/PatchedIncomingEmail';
import type { PatchedIncomingEmailAttachment } from '../models/PatchedIncomingEmailAttachment';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class IncomingService {
    /**
     * @returns IncomingEmailAttachment
     * @throws ApiError
     */
    public static incomingIncomingEmailAttachmentsList(): CancelablePromise<Array<IncomingEmailAttachment>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/incoming/incoming-email-attachments/',
        });
    }
    /**
     * @param requestBody
     * @returns IncomingEmailAttachment
     * @throws ApiError
     */
    public static incomingIncomingEmailAttachmentsCreate(
        requestBody: IncomingEmailAttachment,
    ): CancelablePromise<IncomingEmailAttachment> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/incoming/incoming-email-attachments/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns IncomingEmailAttachment
     * @throws ApiError
     */
    public static incomingIncomingEmailAttachmentsRetrieve(
        id: string,
    ): CancelablePromise<IncomingEmailAttachment> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/incoming/incoming-email-attachments/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns IncomingEmailAttachment
     * @throws ApiError
     */
    public static incomingIncomingEmailAttachmentsUpdate(
        id: string,
        requestBody: IncomingEmailAttachment,
    ): CancelablePromise<IncomingEmailAttachment> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/incoming/incoming-email-attachments/{id}/',
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
     * @returns IncomingEmailAttachment
     * @throws ApiError
     */
    public static incomingIncomingEmailAttachmentsPartialUpdate(
        id: string,
        requestBody?: PatchedIncomingEmailAttachment,
    ): CancelablePromise<IncomingEmailAttachment> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/incoming/incoming-email-attachments/{id}/',
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
    public static incomingIncomingEmailAttachmentsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/incoming/incoming-email-attachments/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns IncomingEmail
     * @throws ApiError
     */
    public static incomingIncomingEmailsList(): CancelablePromise<Array<IncomingEmail>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/incoming/incoming-emails/',
        });
    }
    /**
     * @param requestBody
     * @returns IncomingEmail
     * @throws ApiError
     */
    public static incomingIncomingEmailsCreate(
        requestBody: IncomingEmail,
    ): CancelablePromise<IncomingEmail> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/incoming/incoming-emails/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns IncomingEmail
     * @throws ApiError
     */
    public static incomingIncomingEmailsRetrieve(
        id: string,
    ): CancelablePromise<IncomingEmail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/incoming/incoming-emails/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns IncomingEmail
     * @throws ApiError
     */
    public static incomingIncomingEmailsUpdate(
        id: string,
        requestBody: IncomingEmail,
    ): CancelablePromise<IncomingEmail> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/incoming/incoming-emails/{id}/',
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
     * @returns IncomingEmail
     * @throws ApiError
     */
    public static incomingIncomingEmailsPartialUpdate(
        id: string,
        requestBody?: PatchedIncomingEmail,
    ): CancelablePromise<IncomingEmail> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/incoming/incoming-emails/{id}/',
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
    public static incomingIncomingEmailsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/incoming/incoming-emails/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
