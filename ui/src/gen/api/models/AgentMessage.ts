/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentMessageRoleEnum } from './AgentMessageRoleEnum';
/**
 * A persisted turn — everything the UI needs to re-render it identically.
 */
export type AgentMessage = {
    readonly id: string;
    readonly role: AgentMessageRoleEnum;
    readonly content: string;
    readonly citations: any;
    readonly metadata: any;
    readonly created_at: string;
};

