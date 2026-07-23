import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  addStockItemToList,
  bulkDeleteShoppingItems,
  createShoppingItem,
  deleteShoppingItem,
  fetchShoppingItems,
  updateShoppingItem,
  type ShoppingItemPayload,
  type ShoppingListItem,
} from '@/lib/api/shopping';
import { toast } from '@/lib/toast';

export const shoppingKeys = {
  all: ['shopping'] as const,
  list: () => [...shoppingKeys.all, 'list'] as const,
};

export function useShoppingItems() {
  return useQuery<ShoppingListItem[]>({
    queryKey: shoppingKeys.list(),
    queryFn: fetchShoppingItems,
  });
}

export function useCreateShoppingItem() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ShoppingItemPayload) => createShoppingItem(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shoppingKeys.list() });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateShoppingItem() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ShoppingItemPayload> & { checked?: boolean } }) =>
      updateShoppingItem(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shoppingKeys.list() });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: shoppingKeys.list() }),
  });
}

export function useBulkDeleteShoppingItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteShoppingItems(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: shoppingKeys.list() }),
  });
}

export function useAddStockItemToList() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ stockItemId, quantity }: { stockItemId: string; quantity?: number | null }) =>
      addStockItemToList(stockItemId, { quantity }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: shoppingKeys.list() });
      toast({
        description: result.already_in_list
          ? t('shoppingList.fromStock.alreadyInList', { name: result.label })
          : t('shoppingList.fromStock.added', { name: result.label }),
        variant: result.already_in_list ? 'default' : 'success',
      });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
