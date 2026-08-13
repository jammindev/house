import { useQuery, useMutation } from '@tanstack/react-query';
import { useInvalidate } from '@/lib/invalidate';
import { useTranslation } from 'react-i18next';
import {
  fetchStockItems,
  fetchStockItem,
  fetchStockItemInteractions,
  fetchStockCategories,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  createStockCategory,
  updateStockCategory,
  deleteStockCategory,
  purchaseStockItem,
  recordStockInventory,
  fetchStockConsumption,
  fetchStockReadings,
  updateStockReading,
  deleteStockReading,
  undoStockPurchase,
  type StockItem,
  type StockCategory,
  type StockPurchasePayload,
  type StockInventoryPayload,
  type StockReadingPatch,
  type ConsumptionPeriod,
} from '@/lib/api/stock';
import { toast } from '@/lib/toast';

interface StockFilters {
  search?: string;
  status?: string;
  zone?: string;
  category?: string;
}

export const stockKeys = {
  all: ['stock'] as const,
  items: (filters?: StockFilters) => [...stockKeys.all, 'items', filters] as const,
  categories: () => [...stockKeys.all, 'categories'] as const,
  detail: (id: string) => [...stockKeys.all, 'detail', id] as const,
  readings: (id: string) => [...stockKeys.all, 'readings', id] as const,
};

export function useStockItems(filters: StockFilters = {}) {
  return useQuery({
    queryKey: stockKeys.items(filters),
    queryFn: () => fetchStockItems(filters),
  });
}

export function useStockItem(id: string) {
  return useQuery({
    queryKey: stockKeys.detail(id),
    queryFn: () => fetchStockItem(id),
    enabled: !!id,
  });
}

export function useStockItemHistory(id: string) {
  return useQuery({
    queryKey: [...stockKeys.detail(id), 'interactions'],
    queryFn: () => fetchStockItemInteractions(id),
    enabled: !!id,
  });
}

export function useStockConsumption(id: string, period: ConsumptionPeriod) {
  return useQuery({
    queryKey: [...stockKeys.detail(id), 'consumption', period],
    queryFn: () => fetchStockConsumption(id, period),
    enabled: !!id,
  });
}

export function useStockCategories() {
  return useQuery({
    queryKey: stockKeys.categories(),
    queryFn: fetchStockCategories,
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

export function useCreateStockItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createStockItem,
    onSuccess: () => invalidate('stock'),
  });
}

export function useUpdateStockItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateStockItem>[1] }) =>
      updateStockItem(id, payload),
    onSuccess: () => invalidate('stock'),
  });
}

export function useDeleteStockItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteStockItem(id),
    onSuccess: () => invalidate('stock'),
  });
}

export function usePurchaseStockItem() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockPurchasePayload }) =>
      purchaseStockItem(id, payload),
    onSuccess: () => {
      invalidate('stock', 'interactions');
            toast({ description: t('stock.purchase.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useRecordInventory() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockInventoryPayload }) =>
      recordStockInventory(id, payload),
    onSuccess: () => {
      invalidate('stock');
      toast({ description: t('stock.inventory.recorded'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useStockReadings(id: string) {
  return useQuery({
    queryKey: stockKeys.readings(id),
    queryFn: () => fetchStockReadings(id),
    enabled: !!id,
  });
}

/** Corriger un relevé : le serveur réaligne l'article sur sa dernière lecture. */
export function useUpdateStockReading() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockReadingPatch }) =>
      updateStockReading(id, payload),
    onSuccess: () => {
      invalidate('stock');
      toast({ description: t('stock.readings.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteStockReading() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteStockReading(id),
    onSuccess: () => {
      invalidate('stock');
      toast({ description: t('stock.readings.deleted'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/**
 * Supprimer une dépense d'achat **et** le mouvement de stock qu'elle a produit.
 *
 * Le `DELETE` générique d'une interaction ne touche pas au stock : la lecture de
 * niveau reste, sa source passe à `NULL`, la quantité ne bouge pas. `undo-purchase`
 * est le seul chemin qui défait les trois d'un coup.
 */
export function useUndoStockPurchase() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (interactionId: string) => undoStockPurchase(interactionId),
    onSuccess: () => {
      invalidate('stock', 'interactions');
      toast({ description: t('stock.purchase.undone'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createStockCategory,
    onSuccess: () => invalidate('stock'),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateStockCategory>[1];
    }) => updateStockCategory(id, payload),
    onSuccess: () => invalidate('stock'),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteStockCategory(id),
    onSuccess: () => invalidate('stock'),
  });
}

export type { StockItem, StockCategory };
