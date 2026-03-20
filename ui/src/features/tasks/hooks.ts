import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/context';
import {
  fetchTasks, fetchHouseholdMembers, fetchZones, fetchProjectTasks,
  updateTaskStatus, updateTask, createTask, deleteTask,
  fetchTaskDocuments, linkDocumentToTask, unlinkDocumentFromTask,
  fetchTaskInteractions, linkInteractionToTask, unlinkInteractionFromTask,
  type Task, type TaskStatus,
} from '@/lib/api/tasks';


export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  project: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
};

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.list(),
    queryFn: fetchTasks,
    select: (data) => data.filter((t) => t.status !== 'archived'),
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

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
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
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useUpdateTaskAssignee() {
  const qc = useQueryClient();
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
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, documentId }: { taskId: string; documentId: string | number }) =>
      linkDocumentToTask(taskId, documentId),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, taskId, 'documents'] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUnlinkDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, taskId: _taskId }: { linkId: number; taskId: string }) =>
      unlinkDocumentFromTask(linkId),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, taskId, 'documents'] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, interactionId }: { taskId: string; interactionId: string }) =>
      linkInteractionToTask(taskId, interactionId),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, taskId, 'interactions'] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUnlinkInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, taskId: _taskId }: { linkId: number; taskId: string }) =>
      unlinkInteractionFromTask(linkId),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: [...taskKeys.all, taskId, 'interactions'] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
