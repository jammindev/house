/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for Task↔Document links (backed by DocumentLink).
 *
 * Preserves the former TaskDocument link shape: ``id`` is the DocumentLink pk
 * (used by the frontend to detach), ``task`` the task UUID, ``document`` its int pk.
 */
export type TaskDocumentLink = {
    readonly id: number;
    task: string;
    document: number;
    note?: string;
    readonly created_at: string;
    readonly created_by: string;
};

