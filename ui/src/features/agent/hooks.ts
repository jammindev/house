import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { deleteTask, updateTask } from '@/lib/api/tasks';
import { deleteInteraction, updateInteraction } from '@/lib/api/interactions';
import { deleteMeterReading } from '@/lib/api/electricity';
import { deleteWaterReading, updateWaterReading } from '@/lib/api/water';
import {
  archiveTracker,
  deleteTrackerEntry,
  updateTracker,
  updateTrackerEntry,
} from '@/lib/api/trackers';
import { deleteChicken, deleteEggLog, updateChicken } from '@/lib/api/chickens';
import { deleteStockItem, undoStockPurchase } from '@/lib/api/stock';
import { deleteBudget, updateBudget } from '@/lib/api/budget';
import { taskKeys } from '@/features/tasks/hooks';
import { stockKeys } from '@/features/stock/hooks';
import { budgetKeys } from '@/features/budget/hooks';
import { chickenKeys } from '@/features/chickens/hooks';
import { interactionKeys } from '@/features/interactions/hooks';
import { electricityKeys } from '@/features/electricity/hooks';
import { waterKeys } from '@/features/water/hooks';
import { trackerKeys } from '@/features/trackers/hooks';
import {
  clearMemories,
  createConversation,
  createMemory,
  deleteConversation,
  deleteMemory,
  getConversation,
  getOrCreateEntityConversation,
  listConversations,
  listMemories,
  pinContext,
  postConversationMessage,
  renameConversation,
  searchHouseholdEntities,
  streamConversationMessage,
  unpinContext,
  updateMemory,
  type AgentConversationDetail,
  type AgentConversationRow,
  type AgentCreatedEntity,
  type AgentMemory,
  type AgentMemoryEvent,
  type AgentMessageRow,
  type AgentSearchResult,
  type AgentStreamHandlers,
  type AgentUpdatedEntity,
} from './api';

export const agentKeys = {
  all: ['agent'] as const,
  conversations: () => [...agentKeys.all, 'conversations'] as const,
  conversation: (id: string | null) => [...agentKeys.all, 'conversation', id] as const,
  entityConversation: (entityType: string, objectId: string) =>
    [...agentKeys.all, 'entity-conversation', entityType, objectId] as const,
  contextSearch: (query: string) => [...agentKeys.all, 'context-search', query] as const,
  memories: () => [...agentKeys.all, 'memories'] as const,
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

/**
 * Pin/unpin a household entity to a conversation's context. Both write the
 * refreshed conversation back into `queryKey` (the caller's cache slot, e.g. the
 * entity conversation) AND the by-id detail cache, so the "what I know" panel and
 * every next ask stay in sync without a refetch.
 */
function useContextMutation(
  queryKey: readonly unknown[],
  fn: (conversationId: string, entityType: string, objectId: string) => Promise<AgentConversationDetail>,
) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation<
    AgentConversationDetail,
    unknown,
    { conversationId: string; entityType: string; objectId: string }
  >({
    mutationFn: ({ conversationId, entityType, objectId }) =>
      fn(conversationId, entityType, objectId),
    onSuccess: (detail) => {
      qc.setQueryData(queryKey, detail);
      qc.setQueryData(agentKeys.conversation(detail.id), detail);
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function usePinContext(queryKey: readonly unknown[]) {
  return useContextMutation(queryKey, pinContext);
}

export function useUnpinContext(queryKey: readonly unknown[]) {
  return useContextMutation(queryKey, unpinContext);
}

/** Search household entities for the context picker (enabled once the query is ≥ 2 chars). */
export function useContextSearch(query: string) {
  const trimmed = query.trim();
  return useQuery<AgentSearchResult[]>({
    queryKey: agentKeys.contextSearch(trimmed),
    queryFn: () => searchHouseholdEntities(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
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
    { conversationId: string; question: string; webSearch?: boolean }
  >({
    mutationFn: ({ conversationId, question, webSearch }) =>
      postConversationMessage(conversationId, question, webSearch),
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
    {
      conversationId: string;
      question: string;
      handlers?: AgentStreamHandlers;
      webSearch?: boolean;
    }
  >({
    mutationFn: ({ conversationId, question, handlers, webSearch }) =>
      streamConversationMessage(conversationId, question, handlers, webSearch),
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
  renovation: {
    // a renovation log entry is an Interaction — same hard delete as a note
    remove: (id) => deleteInteraction(id),
    keys: [interactionKeys.all as unknown as unknown[], ['renovation'], ['zones']],
  },
  meter_reading: {
    // the DELETE regenerates the derived daily estimates server-side
    remove: (id) => deleteMeterReading(id),
    keys: [electricityKeys.all as unknown as unknown[]],
  },
  water_reading: {
    // no derived state server-side — consumption is recomputed on the fly
    remove: (id) => deleteWaterReading(id),
    keys: [waterKeys.all as unknown as unknown[]],
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
  chicken: {
    remove: (id) => deleteChicken(id),
    keys: [chickenKeys.all as unknown as unknown[]],
  },
  egg_log: {
    // one row per day (upserted) — undo removes the whole day's log
    remove: (id) => deleteEggLog(id),
    keys: [chickenKeys.all as unknown as unknown[]],
  },
  stock_item: {
    remove: (id) => deleteStockItem(id),
    keys: [stockKeys.all as unknown as unknown[]],
  },
  stock_purchase: {
    // reverses the expense + level readings and restores the item quantity
    remove: (id) => undoStockPurchase(id),
    keys: [stockKeys.all as unknown as unknown[], ['interactions']],
  },
  budget: {
    // hard delete; attached expenses fall back to "hors budget" (SET_NULL)
    remove: (id) => deleteBudget(id),
    keys: [budgetKeys.all as unknown as unknown[]],
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
  water_reading: {
    restore: (id, previous) =>
      updateWaterReading(id, previous as Parameters<typeof updateWaterReading>[1]),
    keys: [waterKeys.all as unknown as unknown[]],
  },
  chicken: {
    restore: (id, previous) =>
      updateChicken(id, previous as Parameters<typeof updateChicken>[1]),
    keys: [chickenKeys.all as unknown as unknown[]],
  },
  budget: {
    restore: (id, previous) =>
      updateBudget(id, previous as Parameters<typeof updateBudget>[1]),
    keys: [budgetKeys.all as unknown as unknown[]],
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

// --- User memory ---------------------------------------------------------------

export function useMemories() {
  return useQuery<AgentMemory[]>({
    queryKey: agentKeys.memories(),
    queryFn: listMemories,
  });
}

export function useUpdateMemory() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation<AgentMemory, unknown, { id: string; content: string }>({
    mutationFn: ({ id, content }) => updateMemory(id, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentKeys.memories() });
      toast({ description: t('agent.memory.updatedToast'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => deleteMemory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.memories() }),
  });
}

export function useClearMemories() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation<number, unknown, void>({
    mutationFn: () => clearMemories(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentKeys.memories() });
      toast({ description: t('agent.memory.clearedToast'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/**
 * Surface a "📌 memorized · Undo" toast for each memory the agent wrote this
 * turn (saved / updated / forgotten via manage_memory). The undo reverses the
 * write: delete a save, restore the previous text of an update, re-create a
 * forgotten memory. Shared by AgentPage and EntityAssistant, like the
 * created/updated undo hooks.
 */
export function useAgentMemoryEvents() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return React.useCallback(
    (events: AgentMemoryEvent[] | undefined) => {
      if (!events?.length) return;
      const refresh = () => void qc.invalidateQueries({ queryKey: agentKeys.memories() });
      refresh();
      for (const event of events) {
        const undo =
          event.action === 'saved'
            ? () => deleteMemory(event.id)
            : event.action === 'updated'
              ? () => updateMemory(event.id, event.previous ?? event.content)
              : () => createMemory(event.content);
        toast({
          title: t(`agent.memory.${event.action}.title`),
          description: event.content,
          duration: 8000,
          action: {
            label: t('common.undo'),
            onClick: () => {
              void Promise.resolve(undo()).then(refresh);
            },
          },
        });
      }
    },
    [qc, t],
  );
}
