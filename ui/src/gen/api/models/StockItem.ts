/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StockItemStatusEnum } from './StockItemStatusEnum';
export type StockItem = {
    readonly id: string;
    readonly household: string;
    category: string;
    readonly category_name: string;
    zone?: string | null;
    readonly zone_name: string;
    name: string;
    description?: string;
    sku?: string;
    barcode?: string;
    quantity?: string;
    unit?: string;
    min_quantity?: string | null;
    max_quantity?: string | null;
    unit_price?: string | null;
    readonly total_value: string;
    purchase_date?: string | null;
    expiration_date?: string | null;
    last_restocked_at?: string | null;
    status?: StockItemStatusEnum;
    supplier?: string;
    notes?: string;
    tags?: Array<string>;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly updated_by: number | null;
};

