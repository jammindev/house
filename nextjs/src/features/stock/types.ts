// nextjs/src/features/stock/types.ts

export type StockItemStatus =
    | "in_stock"
    | "low_stock"
    | "out_of_stock"
    | "ordered"
    | "expired"
    | "reserved";

export type StockCategory = {
    id: string;
    household_id: string;
    name: string;
    color: string;        // hex color code
    emoji: string;        // single emoji
    description: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
};

export type StockItem = {
    id: string;
    household_id: string;
    category_id: string;
    zone_id: string | null;
    name: string;
    description: string;
    sku: string;
    barcode: string;
    quantity: number;
    unit: string;
    min_quantity: number | null;
    max_quantity: number | null;
    unit_price: number | null;
    total_value: number | null;
    purchase_date: string | null;
    expiration_date: string | null;
    last_restocked_at: string | null;
    status: StockItemStatus;
    supplier: string;
    notes: string;
    tags: string[];
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
    // Joined relations
    category?: StockCategory | null;
    zone?: { id: string; name: string } | null;
};

export type StockCategoryPayload = Omit<
    StockCategory,
    "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;

export type StockItemPayload = Omit<
    StockItem,
    | "id"
    | "created_at"
    | "updated_at"
    | "created_by"
    | "updated_by"
    | "total_value"
    | "category"
    | "zone"
>;

export type StockFilters = {
    search?: string;
    categoryId?: string | null;
    zoneId?: string | null;
    statuses?: StockItemStatus[];
};

export type StockCategorySummary = {
    category_id: string;
    household_id: string;
    category_name: string;
    color: string;
    emoji: string;
    item_count: number;
    total_quantity: number;
    total_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
    expiring_soon_count: number;
};
