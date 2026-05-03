import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  fetchStockItems,
  fetchStockCategories,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  createStockCategory,
  updateStockCategory,
  deleteStockCategory,
  purchaseStockItem,
  type StockItem,
  type StockCategory,
  type StockPurchasePayload,
} from '@/lib/api/stock';
import { fetchZones } from '@/lib/api/zones';
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
};

export function useStockItems(filters: StockFilters = {}) {
  return useQuery({
    queryKey: stockKeys.items(filters),
    queryFn: () => fetchStockItems(filters),
  });
}

export function useStockCategories() {
  return useQuery({
    queryKey: stockKeys.categories(),
    queryFn: fetchStockCategories,
  });
}

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  });
}

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStockItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useUpdateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateStockItem>[1] }) =>
      updateStockItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStockItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function usePurchaseStockItem() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockPurchasePayload }) =>
      purchaseStockItem(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ['interactions'] });
      toast({ description: t('stock.purchase.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStockCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateStockCategory>[1];
    }) => updateStockCategory(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStockCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export type { StockItem, StockCategory };
