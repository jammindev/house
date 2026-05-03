/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Document } from '../models/Document';
import type { DocumentDetail } from '../models/DocumentDetail';
import type { PatchedDocument } from '../models/PatchedDocument';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DocumentsService {
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsList(
        ordering?: string,
        search?: string,
    ): CancelablePromise<Array<Document>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/',
            query: {
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsCreate(
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @returns DocumentDetail
     * @throws ApiError
     */
    public static documentsDocumentsRetrieve(
        id: string,
    ): CancelablePromise<DocumentDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsUpdate(
        id: string,
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsPartialUpdate(
        id: string,
        requestBody?: PatchedDocument,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static documentsDocumentsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Re-run text extraction on this document and persist the result.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsReprocessOcrCreate(
        id: string,
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/{id}/reprocess_ocr/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Group documents by type with counts.
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsByTypeRetrieve(): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/by_type/',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param formData
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsUploadCreate(
        formData: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/upload/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
}
