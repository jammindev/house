import { useQuery, useMutation } from '@tanstack/react-query';
import { useInvalidate } from '@/lib/invalidate';
import { useTranslation } from 'react-i18next';
import {
  fetchEquipmentList,
  fetchEquipment,
  fetchEquipmentInteractions,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  registerEquipmentPurchase,
  type EquipmentPayload,
  type EquipmentPurchasePayload,
} from '@/lib/api/equipment';
import { toast } from '@/lib/toast';

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

export function useEquipment(id: string) {
  return useQuery({
    queryKey: equipmentKeys.detail(id),
    queryFn: () => fetchEquipment(id),
    enabled: !!id,
  });
}

export function useEquipmentHistory(id: string) {
  return useQuery({
    queryKey: [...equipmentKeys.detail(id), 'interactions'],
    queryFn: () => fetchEquipmentInteractions(id),
    enabled: !!id,
  });
}

/**
 * Ré-export du hook canonique : une seule entrée de cache pour les zones.
 *
 * Cette feature avait sa propre copie avec la clé `['zones']`, distincte de
 * `zoneKeys.list()` (`['zones', 'list']`) — donc la même liste était chargée
 * deux fois et une écriture n'invalidait pas toujours les deux copies.
 */
export { useZones } from '@/features/zones/hooks';

export function useCreateEquipment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: EquipmentPayload) => createEquipment(payload),
    onSuccess: () => invalidate('equipment'),
  });
}

export function useUpdateEquipment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EquipmentPayload }) =>
      updateEquipment(id, payload),
    onSuccess: () => invalidate('equipment'),
  });
}

export function useDeleteEquipment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: () => invalidate('equipment'),
  });
}

export function useRegisterEquipmentPurchase() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EquipmentPurchasePayload }) =>
      registerEquipmentPurchase(id, payload),
    onSuccess: () => {
      invalidate('equipment', 'interactions');
            toast({ description: t('equipment.purchase.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
