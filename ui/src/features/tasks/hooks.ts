import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTasks, fetchHouseholdMembers, fetchZones, fetchProjectTasks,
  updateTaskStatus, updateTask, createTask, deleteTask,
  type Task, type TaskStatus,
} from '@/lib/api/tasks';

export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
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

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: [...taskKeys.all, 'project', projectId] as const,
    queryFn: () => fetchProjectTasks(projectId),
    enabled: Boolean(projectId),
    select: (data) => data.filter((t) => t.status !== 'archived'),
  });
}
