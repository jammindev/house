import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { deleteTask, updateTask } from '@/lib/api/tasks';
import { deleteInteraction, updateInteraction } from '@/lib/api/interactions';
import { deleteMeterReading } from '@/lib/api/electricity';
import {
  archiveTracker,
  deleteTrackerEntry,
  updateTracker,
  updateTrackerEntry,
} from '@/lib/api/trackers';
import { taskKeys } from '@/features/tasks/hooks';
import { interactionKeys } from '@/features/interactions/hooks';
import { electricityKeys } from '@/features/electricity/hooks';
import { trackerKeys } from '@/features/trackers/hooks';
import {
  createConversation,
  deleteConversation,
  getConversation,
  getOrCreateEntityConversation,
  listConversations,
  postConversationMessage,
  renameConversation,
  streamConversationMessage,
  type AgentConversationDetail,
  type AgentConversationRow,
  type AgentCreatedEntity,
  type AgentMessageRow,
  type AgentStreamHandlers,
  type AgentUpdatedEntity,
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

/**
 * Streaming counterpart of `usePostMessage`: same terminal payload and cache
 * invalidations, plus live `handlers` (deltas, tool status) while the agent
 * works. `isPending` covers the whole stream.
 */
export function useStreamMessage() {
  const qc = useQueryClient();
  return useMutation<
    AgentMessageRow,
    unknown,
    { conversationId: string; question: string; handlers?: AgentStreamHandlers }
  >({
    mutationFn: ({ conversationId, question, handlers }) =>
      streamConversationMessage(conversationId, question, handlers),
    onSuccess: (_msg, { conversationId }) => {
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

/**
 * How to undo a created entity, per entity_type. Each returns a promise and the
 * query keys to invalidate so lists refresh after create AND after undo. Adding
 * a new creatable entity here = one entry (mirrors the backend writables registry).
 */
const UNDO_HANDLERS: Record<
  string,
  { remove: (id: string) => Promise<void>; keys: readonly unknown[][] }
> = {
  task: { remove: (id) => deleteTask(id), keys: [taskKeys.all as unknown as unknown[]] },
  note: {
    remove: (id) => deleteInteraction(id),
    keys: [interactionKeys.all as unknown as unknown[]],
  },
  meter_reading: {
    // the DELETE regenerates the derived daily estimates server-side
    remove: (id) => deleteMeterReading(id),
    keys: [electricityKeys.all as unknown as unknown[]],
  },
  tracker: {
    // the tracker DELETE archives (history is kept) — good enough as an undo
    remove: (id) => archiveTracker(id),
    keys: [trackerKeys.all as unknown as unknown[]],
  },
  tracker_entry: {
    // the DELETE refreshes the tracker cache (last value, summary) server-side
    remove: (id) => deleteTrackerEntry(id),
    keys: [trackerKeys.all as unknown as unknown[]],
  },
};

/**
 * Surface a "created · Undo" toast for each entity the agent just created, and
 * refresh the relevant lists. On "Undo", the entity is deleted (archived) again.
 * Shared by AgentPage and EntityAssistant.
 */
export function useAgentCreatedUndo() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return React.useCallback(
    (created: AgentCreatedEntity[] | undefined) => {
      if (!created?.length) return;
      for (const entity of created) {
        const handler = UNDO_HANDLERS[entity.entity_type];
        if (!handler) continue;
        handler.keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
        toast({
          title: t('agent.created.title', { label: entity.label }),
          duration: 8000,
          action: {
            label: t('common.undo'),
            onClick: () => {
              void handler.remove(entity.id).then(() => {
                handler.keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
              });
            },
          },
        });
      }
    },
    [qc, t],
  );
}

/**
 * How to undo an updated entity, per entity_type: re-apply the `previous` field
 * values through the entity's normal update API. Mirrors the backend writables
 * registry (update side), like UNDO_HANDLERS mirrors its create side.
 */
const UPDATE_UNDO_HANDLERS: Record<
  string,
  {
    restore: (id: string, previous: Record<string, unknown>) => Promise<unknown>;
    keys: readonly unknown[][];
  }
> = {
  task: {
    restore: (id, previous) => updateTask(id, previous as Parameters<typeof updateTask>[1]),
    keys: [taskKeys.all as unknown as unknown[]],
  },
  note: {
    restore: (id, previous) =>
      updateInteraction(id, previous as Parameters<typeof updateInteraction>[1]),
    keys: [interactionKeys.all as unknown as unknown[]],
  },
  tracker: {
    restore: (id, previous) =>
      updateTracker(id, previous as Parameters<typeof updateTracker>[1]),
    keys: [trackerKeys.all as unknown as unknown[]],
  },
  tracker_entry: {
    restore: (id, previous) =>
      updateTrackerEntry(id, previous as Parameters<typeof updateTrackerEntry>[1]),
    keys: [trackerKeys.all as unknown as unknown[]],
  },
};

/**
 * Surface an "updated · Undo" toast for each entity the agent just modified,
 * and refresh the relevant lists. On "Undo", the previous field values are
 * re-applied. Shared by AgentPage and EntityAssistant.
 */
export function useAgentUpdatedUndo() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return React.useCallback(
    (updated: AgentUpdatedEntity[] | undefined) => {
      if (!updated?.length) return;
      for (const entity of updated) {
        const handler = UPDATE_UNDO_HANDLERS[entity.entity_type];
        if (!handler) continue;
        handler.keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
        toast({
          title: t('agent.updated.title', { label: entity.label }),
          duration: 8000,
          action: {
            label: t('common.undo'),
            onClick: () => {
              void handler.restore(entity.id, entity.previous).then(() => {
                handler.keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
              });
            },
          },
        });
      }
    },
    [qc, t],
  );
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => deleteConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.conversations() }),
  });
}
