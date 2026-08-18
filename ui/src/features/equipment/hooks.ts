import { useQuery, useMutation } from '@tanstack/react-query';
import { useInvalidate } from '@/lib/invalidate';
import { useTranslation } from 'react-i18next';
import {
  fetchEquipmentList,
  fetchEquipment,
  fetchEquipmentAttention,
  fetchEquipmentHistory,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  logEquipmentService,
  registerEquipmentPurchase,
  type EquipmentPayload,
  type EquipmentPurchasePayload,
  type EquipmentServicePayload,
} from '@/lib/api/equipment';
import { toast } from '@/lib/toast';

interface EquipmentFilters {
  search?: string;
  status?: string;
  zone?: string;
  category?: string;
  attention?: string;
}

export const equipmentKeys = {
  all: ['equipment'] as const,
  list: (filters?: EquipmentFilters) => [...equipmentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...equipmentKeys.all, id] as const,
  attention: () => [...equipmentKeys.all, 'attention'] as const,
  history: (id: string) => [...equipmentKeys.detail(id), 'history'] as const,
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

/**
 * Les compteurs du bandeau — volontairement **hors des filtres** de la liste.
 *
 * Un bandeau qui annoncerait « 0 entretien en retard » parce qu'on regarde le
 * garage transformerait un filtre d'affichage en verdict sur le foyer.
 */
export function useEquipmentAttention() {
  return useQuery({
    queryKey: equipmentKeys.attention(),
    queryFn: () => fetchEquipmentAttention(),
  });
}

export function useEquipmentHistory(id: string) {
  return useQuery({
    queryKey: equipmentKeys.history(id),
    queryFn: () => fetchEquipmentHistory(id),
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

/**
 * « Entretien fait » — le geste le plus courant du module, en un clic.
 *
 * Invalide `equipment` **et** `interactions` : l'écriture est double (la date
 * sur la fiche, la trace dans le journal), donc les deux racines sont écrites.
 * `alerts` en dérive par le graphe de `lib/invalidate.ts` — c'est ce qui éteint
 * la pastille sans que ce hook ait à la connaître.
 */
export function useLogEquipmentService() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: EquipmentServicePayload }) =>
      logEquipmentService(id, payload ?? {}),
    onSuccess: () => {
      invalidate('equipment', 'interactions');
      toast({ description: t('equipment.service.recorded'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
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
