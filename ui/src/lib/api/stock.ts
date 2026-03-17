import { api } from '@/lib/axios';
import type { ZoneOption } from './zones';

export type StockItemStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'ordered'
  | 'expired'
  | 'reserved';

export interface StockCategory {
  id: string;
  household: string;
  name: string;
  color: string;
  emoji: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StockCategorySummary {
  category_id: string;
  category_name: string;
  color: string;
  emoji: string;
  item_count: number;
  total_quantity: string;
  total_value: string;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
}

export interface StockItem {
  id: string;
  household: string;
  category: string;
  category_name?: string;
  zone: string | null;
  zone_name?: string | null;
  name: string;
  description: string;
  sku: string;
  barcode: string;
  quantity: string;
  unit: string;
  min_quantity: string | null;
  max_quantity: string | null;
  unit_price: string | null;
  total_value: string | null;
  purchase_date: string | null;
  expiration_date: string | null;
  last_restocked_at: string | null;
  status: StockItemStatus;
  supplier: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  results?: T[];
}

interface StockListFilters {
  search?: string;
  status?: string;
  zone?: string;
  category?: string;
}

interface StockItemPayload {
  category: string;
  zone?: string | null;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unit: string;
  min_quantity?: number | null;
  max_quantity?: number | null;
  unit_price?: number | null;
  purchase_date?: string | null;
  expiration_date?: string | null;
  status: StockItemStatus;
  supplier?: string;
  notes?: string;
  tags?: string[];
}

interface StockCategoryPayload {
  name: string;
  color: string;
  emoji: string;
  description?: string;
  sort_order?: number;
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const paginated = payload as PaginatedResponse<T>;
    if (Array.isArray(paginated.results)) return paginated.results;
  }
  return [];
}

export async function fetchStockItems(filters: StockListFilters = {}): Promise<StockItem[]> {
  const params: Record<string, string> = { ordering: 'name' };
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.zone) params.zone = filters.zone;
  if (filters.category) params.category = filters.category;

  const { data } = await api.get('/stock/', { params });
  return normalizeList<StockItem>(data);
}

export async function fetchStockItem(itemId: string): Promise<StockItem> {
  const { data } = await api.get(`/stock/${itemId}/`);
  return data as StockItem;
}

export async function createStockItem(payload: StockItemPayload): Promise<StockItem> {
  const { data } = await api.post('/stock/', {
    ...payload,
    zone: payload.zone || null,
    min_quantity: payload.min_quantity ?? null,
    max_quantity: payload.max_quantity ?? null,
    unit_price: payload.unit_price ?? null,
    purchase_date: payload.purchase_date || null,
    expiration_date: payload.expiration_date || null,
    description: payload.description ?? '',
    supplier: payload.supplier ?? '',
    notes: payload.notes ?? '',
    tags: payload.tags ?? [],
  });
  return data as StockItem;
}

export async function updateStockItem(itemId: string, payload: StockItemPayload): Promise<StockItem> {
  const { data } = await api.patch(`/stock/${itemId}/`, {
    ...payload,
    zone: payload.zone || null,
    min_quantity: payload.min_quantity ?? null,
    max_quantity: payload.max_quantity ?? null,
    unit_price: payload.unit_price ?? null,
    purchase_date: payload.purchase_date || null,
    expiration_date: payload.expiration_date || null,
    description: payload.description ?? '',
    supplier: payload.supplier ?? '',
    notes: payload.notes ?? '',
    tags: payload.tags ?? [],
  });
  return data as StockItem;
}

export async function deleteStockItem(itemId: string): Promise<void> {
  await api.delete(`/stock/${itemId}/`);
}

export async function adjustStockQuantity(itemId: string, delta: number): Promise<StockItem> {
  const { data } = await api.post(`/stock/${itemId}/adjust-quantity/`, { delta });
  return data as StockItem;
}

export async function fetchStockCategories(): Promise<StockCategory[]> {
  const { data } = await api.get('/stock/categories/', {
    params: { ordering: 'sort_order,name' },
  });
  return normalizeList<StockCategory>(data);
}

export async function fetchStockCategorySummary(): Promise<StockCategorySummary[]> {
  const { data } = await api.get('/stock/categories/summary/');
  return data as StockCategorySummary[];
}

export async function createStockCategory(payload: StockCategoryPayload): Promise<StockCategory> {
  const { data } = await api.post('/stock/categories/', payload);
  return data as StockCategory;
}

export async function updateStockCategory(
  categoryId: string,
  payload: Partial<StockCategoryPayload>,
): Promise<StockCategory> {
  const { data } = await api.patch(`/stock/categories/${categoryId}/`, payload);
  return data as StockCategory;
}

export async function deleteStockCategory(categoryId: string): Promise<void> {
  await api.delete(`/stock/categories/${categoryId}/`);
}

export function zoneLabel(zoneId: string | null | undefined, zones: ZoneOption[]): string {
  if (!zoneId) return '—';
  return zones.find((zone) => zone.id === zoneId)?.full_path ?? zones.find((zone) => zone.id === zoneId)?.name ?? '—';
}
