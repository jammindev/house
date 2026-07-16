import { api } from '@/lib/axios';
import type { StockItemStatus } from './stock';

export interface ShoppingListItem {
  id: string;
  household: string;
  label: string;
  quantity: string | null;
  unit: string;
  note: string;
  stock_item: string | null;
  stock_item_name: string | null;
  stock_item_status: StockItemStatus | null;
  stock_item_emoji: string | null;
  checked: boolean;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_name: string | null;
}

interface PaginatedResponse<T> {
  results?: T[];
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<T>;
    if (Array.isArray(paginated.results)) return paginated.results;
  }
  return [];
}

export interface ShoppingItemPayload {
  label: string;
  quantity?: number | null;
  unit?: string;
  note?: string;
}

export async function fetchShoppingItems(): Promise<ShoppingListItem[]> {
  const { data } = await api.get('/shopping/items/', { params: { ordering: 'sort_order,created_at' } });
  return normalizeList<ShoppingListItem>(data);
}

export async function createShoppingItem(payload: ShoppingItemPayload): Promise<ShoppingListItem> {
  const { data } = await api.post('/shopping/items/', {
    label: payload.label,
    quantity: payload.quantity ?? null,
    unit: payload.unit ?? '',
    note: payload.note ?? '',
  });
  return data as ShoppingListItem;
}

export async function updateShoppingItem(
  id: string,
  payload: Partial<ShoppingItemPayload> & { checked?: boolean },
): Promise<ShoppingListItem> {
  const { data } = await api.patch(`/shopping/items/${id}/`, payload);
  return data as ShoppingListItem;
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await api.delete(`/shopping/items/${id}/`);
}

export interface AddFromStockResult extends ShoppingListItem {
  already_in_list: boolean;
}

/** Add a stock item to the list (Lot 2). Deduped server-side. */
export async function addStockItemToList(
  stockItemId: string,
  opts: { quantity?: number | null; note?: string } = {},
): Promise<AddFromStockResult> {
  const { data } = await api.post('/shopping/items/from-stock/', {
    stock_item: stockItemId,
    quantity: opts.quantity ?? null,
    note: opts.note ?? '',
  });
  return data as AddFromStockResult;
}

/** Delete several lines at once (powers "Clear checked" + its undo). */
export async function bulkDeleteShoppingItems(ids: string[]): Promise<void> {
  await api.post('/shopping/items/bulk-delete/', { ids });
}
