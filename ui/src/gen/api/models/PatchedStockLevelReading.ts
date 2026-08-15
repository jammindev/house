/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StockLevelReadingKindEnum } from './StockLevelReadingKindEnum';
/**
 * Une lecture de niveau, telle qu'elle se lit et se corrige.
 *
 * ``kind`` et ``source_interaction`` sont en lecture seule : ils disent *d'où
 * vient* la mesure, ce qui n'est pas de l'ordre de la correction. Seuls la
 * quantité et la date se rectifient — le reste serait réécrire l'histoire.
 */
export type PatchedStockLevelReading = {
    readonly id?: string;
    readonly stock_item?: string;
    reading_at?: string;
    quantity?: string;
    readonly kind?: StockLevelReadingKindEnum;
    readonly source_interaction?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
};

