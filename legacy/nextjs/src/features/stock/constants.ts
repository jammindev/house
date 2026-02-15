// nextjs/src/features/stock/constants.ts

import type { StockFilters, StockItemStatus } from "./types";

export const STOCK_ITEM_STATUSES: StockItemStatus[] = [
    "in_stock",
    "low_stock",
    "out_of_stock",
    "ordered",
    "expired",
    "reserved",
];

export const STOCK_STATUS_COLORS: Record<StockItemStatus, string> = {
    in_stock: "bg-emerald-100 text-emerald-800 border-emerald-200",
    low_stock: "bg-amber-100 text-amber-800 border-amber-200",
    out_of_stock: "bg-rose-100 text-rose-800 border-rose-200",
    ordered: "bg-blue-100 text-blue-800 border-blue-200",
    expired: "bg-gray-200 text-gray-800 border-gray-300",
    reserved: "bg-purple-100 text-purple-800 border-purple-200",
};

export const DEFAULT_STOCK_FILTERS: StockFilters = {
    search: "",
    categoryId: null,
    zoneId: null,
    statuses: [],
};

export const DEFAULT_UNITS = [
    "unit",
    "kg",
    "g",
    "l",
    "ml",
    "m",
    "cm",
    "m²",
    "m³",
    "piece",
    "box",
    "bag",
    "bottle",
    "can",
    "pack",
    "roll",
    "sheet",
    "bundle",
];

export const SUGGESTED_CATEGORY_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#64748b", // slate
];

export const SUGGESTED_CATEGORY_EMOJIS = [
    "📦", "🍎", "🥕", "🥩", "🥛", "🍞", "🧀", "🥫", "🍺", "🍷",
    "🔧", "🔩", "🪵", "🧱", "🪨", "⚙️", "🔌", "💡", "🧹", "🧴",
    "🌱", "🌿", "🪴", "🌾", "🐔", "🐄", "🐷", "🐑", "🚜", "⛽",
];
