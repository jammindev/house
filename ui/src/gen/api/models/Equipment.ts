/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EquipmentStatusEnum } from './EquipmentStatusEnum';
export type Equipment = {
    readonly id: string;
    household: string;
    zone?: string | null;
    name: string;
    category?: string;
    manufacturer?: string | null;
    model?: string | null;
    serial_number?: string | null;
    purchase_date?: string | null;
    purchase_price?: string | null;
    purchase_vendor?: string | null;
    warranty_expires_on?: string | null;
    warranty_provider?: string | null;
    warranty_notes?: string;
    maintenance_interval_months?: number | null;
    last_service_at?: string | null;
    status?: EquipmentStatusEnum;
    condition?: string;
    installed_at?: string | null;
    retired_at?: string | null;
    notes?: string;
    tags?: Array<string>;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly updated_by: number | null;
};

