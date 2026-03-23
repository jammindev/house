/**
 * Base serializer with shared household validation helpers.
 */
export type ElectricCircuit = {
    readonly id: string;
    readonly household: string;
    board: string;
    breaker: string;
    label: string;
    name: string;
    is_active?: boolean;
    notes?: string;
    readonly created_at: string;
    readonly updated_at: string;
};

