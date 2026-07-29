import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useInvalidate } from '@/lib/invalidate';
import {
  fetchProjects,
  fetchProject,
  fetchProjectGroups,
  fetchProjectInteractions,
  createProject,
  updateProject,
  deleteProject,
  createProjectGroup,
  updateProjectGroup,
  deleteProjectGroup,
  pinProject,
  unpinProject,
  registerProjectPurchase,
  type ProjectListItem,
  type ProjectInteractionItem,
  type ProjectPayload,
  type ProjectGroupPayload,
  type ProjectPurchasePayload,
} from '@/lib/api/projects';
import { toast } from '@/lib/toast';

interface ProjectFilters {
  search?: string;
  status?: string;
  type?: string;
  group?: string;
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (filters?: ProjectFilters) => [...projectKeys.all, 'list', filters] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  groups: () => [...projectKeys.all, 'groups'] as const,
};

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

export function useProjectInteractions(projectId: string, type?: string) {
  return useQuery<ProjectInteractionItem[]>({
    queryKey: [...projectKeys.detail(projectId), 'interactions', type ?? 'all'],
    queryFn: () => fetchProjectInteractions(projectId, type),
    enabled: !!projectId,
  });
}

export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () =>
      fetchProjects({
        search: filters.search,
        status: filters.status,
        type: filters.type,
        groupId: filters.group,
      }),
  });
}

export function useProjectGroups() {
  return useQuery({
    queryKey: projectKeys.groups(),
    queryFn: fetchProjectGroups,
  });
}

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: ProjectPayload) => createProject(payload),
    onSuccess: () => invalidate('projects'),
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectPayload> }) =>
      updateProject(id, payload),
    onSuccess: () => invalidate('projects'),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => invalidate('projects'),
  });
}

export function useCreateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: ProjectGroupPayload) => createProjectGroup(payload),
    onSuccess: () => invalidate('projects'),
  });
}

export function useUpdateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectGroupPayload> }) =>
      updateProjectGroup(id, payload),
    onSuccess: () => invalidate('projects'),
  });
}

export function useDeleteGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteProjectGroup(id),
    onSuccess: () => invalidate('projects'),
  });
}

export function useRegisterProjectPurchase() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectPurchasePayload }) =>
      registerProjectPurchase(id, payload),
    onSuccess: () => {
      invalidate('projects', 'interactions');
      toast({ description: t('projects.purchase.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function usePinProject() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      pinned ? unpinProject(id) : pinProject(id),
    onMutate: async ({ id, pinned }) => {
      await qc.cancelQueries({ queryKey: projectKeys.all });
      // optimistically toggle is_pinned in every cached list
      qc.setQueriesData<ProjectListItem[]>({ queryKey: projectKeys.all }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((p) => (p.id === id ? { ...p, is_pinned: !pinned } : p));
      });
    },
    onSettled: () => invalidate('projects'),
  });
}
