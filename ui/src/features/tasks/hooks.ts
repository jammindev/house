import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { useInvalidate } from '@/lib/invalidate';
import {
  fetchTasks, fetchTask, fetchHouseholdMembers, fetchProjectTasks,
  updateTaskStatus, updateTask, createTask, deleteTask,
  fetchTaskDocuments, linkDocumentToTask, unlinkDocumentFromTask,
  fetchTaskInteractions, linkInteractionToTask, unlinkInteractionFromTask,
  type Task, type TaskStatus,
} from '@/lib/api/tasks';


export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  project: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
};

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.list(),
    queryFn: () => fetchTasks(),
    select: (data) => data.filter((t) => t.status !== 'archived'),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchTask(id),
    enabled: Boolean(id),
  });
}

export function useHouseholdMembers() {
  return useQuery({
    queryKey: ['household-members'],
    queryFn: fetchHouseholdMembers,
  });
}

export function useHouseholdMembersWithMe() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const query = useHouseholdMembers();

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const data = React.useMemo(() => {
    if (!query.data) return [];
    const currentId = user?.id != null ? String(user.id) : null;
    const mapped = query.data.map((m) => ({
      ...m,
      name: currentId != null && String(m.userId) === currentId ? t('tasks.assignedToMe') : m.name,
    }));
    if (currentId == null) return mapped;
    const idx = mapped.findIndex((m) => String(m.userId) === currentId);
    if (idx <= 0) return mapped;
    return [mapped[idx], ...mapped.slice(0, idx), ...mapped.slice(idx + 1)];
  }, [query.data, user?.id, t]);

  return { ...query, data };
}

/**
 * Ré-export du hook canonique : une seule entrée de cache pour les zones.
 *
 * Cette feature avait sa propre copie avec la clé `['zones']`, distincte de
 * `zoneKeys.list()` (`['zones', 'list']`) — donc la même liste était chargée
 * deux fois et une écriture n'invalidait pas toujours les deux copies.
 */
export { useZones } from '@/features/zones/hooks';

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTaskStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: taskKeys.list() });
      const previous = qc.getQueryData<Task[]>(taskKeys.list());
      qc.setQueryData<Task[]>(taskKeys.list(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)) ?? old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.list(), ctx.previous);
    },
    onSettled: () => invalidate('tasks'),
  });
}

export function useCreateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => invalidate('tasks'),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, payload),
    onSuccess: () => invalidate('tasks'),
  });
}

export function useUpdateTaskAssignee() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, assignedToId }: { id: string; assignedToId: string | null }) =>
      updateTask(id, { assigned_to_id: assignedToId }),
    onMutate: async ({ id, assignedToId }) => {
      await qc.cancelQueries({ queryKey: taskKeys.list() });
      const previous = qc.getQueryData<Task[]>(taskKeys.list());
      qc.setQueryData<Task[]>(taskKeys.list(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, assigned_to: assignedToId } : t)) ?? old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.list(), ctx.previous);
    },
    onSettled: () => invalidate('tasks'),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => invalidate('tasks'),
  });
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.project(projectId),
    queryFn: () => fetchProjectTasks(projectId),
    enabled: Boolean(projectId),
    select: (data) => data.filter((t) => t.status !== 'archived'),
  });
}

// ── Attachment hooks ────────────────────────────────────────────────────────

export function useTaskDocuments(taskId: string) {
  return useQuery({
    queryKey: [...taskKeys.all, taskId, 'documents'] as const,
    queryFn: () => fetchTaskDocuments(taskId),
    enabled: Boolean(taskId),
  });
}

export function useLinkDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ taskId, documentId }: { taskId: string; documentId: string | number }) =>
      linkDocumentToTask(taskId, documentId),
    onSuccess: () => invalidate('tasks'),
  });
}

export function useUnlinkDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ linkId }: { linkId: number; taskId: string }) =>
      unlinkDocumentFromTask(linkId),
    onSuccess: () => invalidate('tasks'),
  });
}

export function useTaskInteractions(taskId: string) {
  return useQuery({
    queryKey: [...taskKeys.all, taskId, 'interactions'] as const,
    queryFn: () => fetchTaskInteractions(taskId),
    enabled: Boolean(taskId),
  });
}

export function useLinkInteraction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ taskId, interactionId }: { taskId: string; interactionId: string }) =>
      linkInteractionToTask(taskId, interactionId),
    onSuccess: () => invalidate('tasks'),
  });
}

export function useUnlinkInteraction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ linkId }: { linkId: number; taskId: string }) =>
      unlinkInteractionFromTask(linkId),
    onSuccess: () => invalidate('tasks'),
  });
}
