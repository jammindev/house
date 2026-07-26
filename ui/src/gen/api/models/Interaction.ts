/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReconciledByEnum } from './ReconciledByEnum';
import type { Type0e0Enum } from './Type0e0Enum';
/**
 * Interaction list/create serializer.
 */
export type Interaction = {
    readonly id: string;
    readonly household: string;
    subject: string;
    content?: string;
    type?: Type0e0Enum;
    /**
     * Whether this interaction is private to the creator
     */
    is_private?: boolean;
    /**
     * When this interaction occurred
     */
    occurred_at?: string | null;
    readonly tags: string;
    tags_input?: Array<string>;
    /**
     * Feature-specific extras (delta, unit, brand, recurring_id…). Structured money fields are now real columns (amount/kind/supplier).
     */
    metadata?: any;
    /**
     * Full-text searchable content with OCR from documents
     */
    enriched_text?: string;
    /**
     * Expense amount. Only for type='expense'; null otherwise.
     */
    amount?: string | null;
    /**
     * Expense discriminator (stock_purchase, equipment_purchase, project_purchase, chickens_purchase, manual, recurring). Empty for non-expense interactions.
     */
    kind?: string;
    /**
     * Expense vendor/supplier. Empty when not applicable.
     */
    supplier?: string;
    source_type?: string | null;
    source_id?: string | null;
    readonly source_label: string;
    zone_ids: Array<string>;
    readonly zone_names: string;
    readonly zone_id_list: string;
    readonly document_count: string;
    readonly linked_document_ids: string;
    document_ids?: Array<string>;
    readonly contacts: string;
    contact_ids?: Array<string>;
    readonly structures: string;
    structure_ids?: Array<string>;
    readonly equipments: string;
    equipment_ids?: Array<string>;
    readonly budget: string;
    budget_id?: string | null;
    /**
     * Bank statement line this expense is an allocation of (parcours 25). There is NO Allocation table: a line split 80/40 simply carries two expenses, each with its own amount and budget. `amount` therefore stays a scalar column and the project's nine Sum('amount') aggregations are untouched. SET_NULL: deleting the bank line never destroys a journalled fact.
     */
    readonly bank_transaction: string | null;
    /**
     * How this expense got attached to its bank line.
     *
     * * `auto` - Automatic
     * * `manual` - Manual
     */
    readonly reconciled_by: ReconciledByEnum;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly created_by_name: string;
};

