import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEquipmentList,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  type EquipmentListItem,
  type EquipmentPayload,
} from '@/lib/api/equipment';
import { fetchZones } from '@/lib/api/zones';

interface EquipmentFilters {
  search?: string;
  status?: string;
  zone?: string;
}

export const equipmentKeys = {
  all: ['equipment'] as const,
  list: (filters?: EquipmentFilters) => [...equipmentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...equipmentKeys.all, 'detail', id] as const,
};

export function useEquipmentList(filters: EquipmentFilters = {}) {
  return useQuery({
    queryKey: equipmentKeys.list(filters),
    queryFn: () => fetchEquipmentList(filters),
  });
}

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  });
}

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EquipmentPayload) => createEquipment(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: equipmentKeys.all }),
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EquipmentPayload }) =>
      updateEquipment(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: equipmentKeys.all }),
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: equipmentKeys.all }),
  });
}
