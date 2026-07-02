/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationDetail } from '../models/ConversationDetail';
import type { ConversationList } from '../models/ConversationList';
import type { ConversationUpdate } from '../models/ConversationUpdate';
import type { PatchedConversationUpdate } from '../models/PatchedConversationUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AgentService {
    /**
     * ``POST /api/agent/ask/`` — answer a household question.
     * @returns any No response body
     * @throws ApiError
     */
    public static agentAskCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/agent/ask/',
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @returns ConversationList
     * @throws ApiError
     */
    public static agentConversationsList(): CancelablePromise<Array<ConversationList>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/agent/conversations/',
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @param requestBody
     * @returns ConversationDetail
     * @throws ApiError
     */
    public static agentConversationsCreate(
        requestBody?: ConversationDetail,
    ): CancelablePromise<ConversationDetail> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/agent/conversations/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @param id
     * @returns ConversationDetail
     * @throws ApiError
     */
    public static agentConversationsRetrieve(
        id: string,
    ): CancelablePromise<ConversationDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/agent/conversations/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @param id
     * @param requestBody
     * @returns ConversationUpdate
     * @throws ApiError
     */
    public static agentConversationsUpdate(
        id: string,
        requestBody?: ConversationUpdate,
    ): CancelablePromise<ConversationUpdate> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/agent/conversations/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @param id
     * @param requestBody
     * @returns ConversationUpdate
     * @throws ApiError
     */
    public static agentConversationsPartialUpdate(
        id: string,
        requestBody?: PatchedConversationUpdate,
    ): CancelablePromise<ConversationUpdate> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/agent/conversations/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static agentConversationsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/agent/conversations/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * CRUD on the user's agent conversations + a `messages` action to ask.
     *
     * Conversations are private per user within a household. `POST
     * conversations/{id}/messages/` runs the agent with the conversation as
     * history, persists both the user turn and the agent answer, and returns the
     * agent message.
     * @param id
     * @param requestBody
     * @returns ConversationDetail
     * @throws ApiError
     */
    public static agentConversationsMessagesCreate(
        id: string,
        requestBody?: ConversationDetail,
    ): CancelablePromise<ConversationDetail> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/agent/conversations/{id}/messages/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get-or-create THE conversation anchored to one entity, for this user.
     *
     * Backs the entity-scoped assistant (e.g. a project's "Assistant" tab):
     * one persistent conversation per (household, user, entity), created on
     * first visit. Query params: ``entity_type`` + ``object_id``, which must
     * name an entity registered in ``agent.searchables``.
     * @returns ConversationDetail
     * @throws ApiError
     */
    public static agentConversationsForContextRetrieve(): CancelablePromise<ConversationDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/agent/conversations/for_context/',
        });
    }
}
