import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  type ProjectListItem,
  type ProjectInteractionItem,
  type ProjectPayload,
  type ProjectGroupPayload,
} from '@/lib/api/projects';
import { fetchZones } from '@/lib/api/zones';

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

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectPayload) => createProject(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectPayload> }) =>
      updateProject(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectGroupPayload) => createProjectGroup(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.groups() }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectGroupPayload> }) =>
      updateProjectGroup(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.groups() }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.groups() }),
  });
}

export function usePinProject() {
  const qc = useQueryClient();
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
    onSettled: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
