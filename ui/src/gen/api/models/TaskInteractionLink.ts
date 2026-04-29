/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read/write serializer for TaskInteraction links.
 */
export type TaskInteractionLink = {
    readonly id: number;
    task: string;
    interaction: string;
    note?: string;
    readonly created_at: string;
    readonly created_by: number | null;
};

