/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * One durable fact the agent knows about the current user.
 *
 * Validation is shared: the ``manage_memory`` tool and the REST viewset both
 * funnel writes through ``agent.memory``, which uses this serializer.
 */
export type AgentMemory = {
    readonly id: string;
    content: string;
    readonly created_at: string;
    readonly updated_at: string;
};

