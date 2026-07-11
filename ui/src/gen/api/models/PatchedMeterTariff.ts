/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Base serializer with shared household validation helpers.
 */
export type PatchedMeterTariff = {
    readonly id?: string;
    readonly household?: string;
    meter?: string;
    valid_from?: string;
    price_base?: string | null;
    price_hp?: string | null;
    price_hc?: string | null;
    subscription_eur_month?: string | null;
    readonly created_at?: string;
    readonly updated_at?: string;
};

