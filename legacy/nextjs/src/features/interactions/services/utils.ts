// nextjs/src/features/interactions/services/utils.ts

/**
 * Utility functions for data transformation and normalization
 */
export class InteractionServiceUtils {
    /**
     * Normalize text values - trim and return null for empty strings
     */
    static normalizeText(value?: string | null): string | null {
        const trimmed = value?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : null;
    }

    /**
     * Normalize boolean values - ensure proper boolean conversion
     */
    static normalizeBoolean(value?: boolean | null): boolean {
        return value === true;
    }
}