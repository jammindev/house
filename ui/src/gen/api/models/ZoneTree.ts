/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Nested serializer for zone hierarchy.
 */
export type ZoneTree = {
    readonly id: string;
    readonly household: string;
    name: string;
    parent?: string | null;
    note?: string;
    /**
     * Surface area (e.g., square meters)
     */
    surface?: string | null;
    /**
     * Hex color code for zone display
     */
    color?: string;
    readonly full_path: string;
    readonly depth: string;
    readonly children_count: string;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly updated_by: number | null;
    readonly children: string;
};

