/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentMessage } from './AgentMessage';
/**
 * Full conversation with its ordered messages. `title` writable on create.
 *
 * ``context_entity_type`` / ``context_object_id`` anchor the conversation to a
 * household entity (write-on-create only): every ask then pre-injects that
 * entity's context. Left blank for a plain, unanchored conversation.
 *
 * ``injected_context`` is the resolved, human-readable view of everything the
 * agent currently knows about (anchor + linked items + user-pinned entities) —
 * it mirrors exactly what ``ask`` pre-injects, so the UI "what I know" panel is
 * honest by construction.
 */
export type ConversationDetail = {
    readonly id: string;
    title?: string;
    readonly last_message_at: string | null;
    readonly created_at: string;
    context_entity_type?: string;
    context_object_id?: string;
    readonly web_search_enabled: boolean;
    readonly injected_context: Array<Record<string, any>>;
    readonly messages: Array<AgentMessage>;
};

