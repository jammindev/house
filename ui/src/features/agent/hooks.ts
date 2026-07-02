import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createConversation,
  deleteConversation,
  getConversation,
  getOrCreateEntityConversation,
  listConversations,
  postConversationMessage,
  renameConversation,
  type AgentConversationDetail,
  type AgentConversationRow,
  type AgentMessageRow,
} from './api';

export const agentKeys = {
  all: ['agent'] as const,
  conversations: () => [...agentKeys.all, 'conversations'] as const,
  conversation: (id: string | null) => [...agentKeys.all, 'conversation', id] as const,
  entityConversation: (entityType: string, objectId: string) =>
    [...agentKeys.all, 'entity-conversation', entityType, objectId] as const,
};

export function useConversations() {
  return useQuery<AgentConversationRow[]>({
    queryKey: agentKeys.conversations(),
    queryFn: listConversations,
  });
}

export function useConversation(id: string | null) {
  return useQuery<AgentConversationDetail>({
    queryKey: agentKeys.conversation(id),
    queryFn: () => getConversation(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Get-or-create the entity-anchored conversation (e.g. a project's assistant).
 * Loads the single persistent conversation for (user, entity), pre-seeded server
 * side with the entity's context. Reuses `usePostMessage` to send turns.
 */
export function useEntityConversation(entityType: string, objectId: string) {
  return useQuery<AgentConversationDetail>({
    queryKey: agentKeys.entityConversation(entityType, objectId),
    queryFn: () => getOrCreateEntityConversation(entityType, objectId),
    enabled: Boolean(entityType && objectId),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation<AgentConversationDetail, unknown, void>({
    mutationFn: () => createConversation(),
    onSuccess: (conversation) => {
      // Seed the detail cache so opening it needs no extra round-trip.
      qc.setQueryData(agentKeys.conversation(conversation.id), conversation);
      void qc.invalidateQueries({ queryKey: agentKeys.conversations() });
    },
  });
}

export function usePostMessage() {
  const qc = useQueryClient();
  return useMutation<
    AgentMessageRow,
    unknown,
    { conversationId: string; question: string }
  >({
    mutationFn: ({ conversationId, question }) =>
      postConversationMessage(conversationId, question),
    onSuccess: (_msg, { conversationId }) => {
      // Recency + auto-title change on the server; refresh the list. The detail
      // is kept in sync locally by the page, so we don't refetch it here.
      void qc.invalidateQueries({ queryKey: agentKeys.conversations() });
      void qc.invalidateQueries({
        queryKey: agentKeys.conversation(conversationId),
        refetchType: 'none',
      });
    },
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation<AgentConversationRow, unknown, { id: string; title: string }>({
    mutationFn: ({ id, title }) => renameConversation(id, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.conversations() }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => deleteConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.conversations() }),
  });
}
