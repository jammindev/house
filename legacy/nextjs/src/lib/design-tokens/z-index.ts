// nextjs/src/lib/design-tokens/z-index.ts
/**
 * Z-Index Design Tokens
 * 
 * Centralized z-index system for consistent layering across the application.
 * Values are organized by context with appropriate spacing to allow insertions.
 */

export const Z_INDEX = {
    // Base layer (normal content)
    base: 0,

    // Content layers (1-10)
    content: {
        raised: 1,      // Slightly raised elements (cards with shadows)
        sticky: 5,      // Sticky headers, navigation elements
    },

    // Interactive layers (10-40)
    interactive: {
        dropdown: 10,   // Dropdown menus, select options
        tooltip: 15,    // Tooltips, small overlays
        popover: 20,    // Popovers, larger contextual overlays
    },

    // Navigation layers (50-80)
    navigation: {
        header: 50,     // Main navigation header
        sidebar: 55,    // Sidebar navigation
        mobileMenu: 60, // Mobile navigation overlays
    },

    // Modal/Dialog layers (90-200)
    overlay: {
        backdrop: 90,   // Modal backdrops
        modal: 100,     // Standard modals and dialogs
        sheet: 110,     // Bottom sheets, side sheets
        drawer: 120,    // Sliding drawers
    },

    // System layers (500+)
    system: {
        toast: 500,     // Toast notifications
        loading: 900,   // Global loading overlays
        debug: 999,     // Debug overlays (dev only)
    },

    // Emergency layer (9999)
    emergency: 9999,  // Critical system messages, emergency overlays
} as const;

/**
 * Utility type to get z-index values with proper TypeScript support
 */
export type ZIndexToken = typeof Z_INDEX;

/**
 * Helper function to get z-index value by path
 * Usage: getZIndex('overlay', 'modal') // returns 100
 */
export function getZIndex<K1 extends keyof ZIndexToken>(
    category: K1
): ZIndexToken[K1] extends number
    ? ZIndexToken[K1]
    : never;

export function getZIndex<
    K1 extends keyof ZIndexToken,
    K2 extends keyof ZIndexToken[K1]
>(
    category: K1,
    subcategory: K2
): ZIndexToken[K1] extends Record<string, any>
    ? ZIndexToken[K1][K2] extends number
    ? ZIndexToken[K1][K2]
    : never
    : never;

export function getZIndex(category: any, subcategory?: any): number {
    const categoryValue = Z_INDEX[category as keyof typeof Z_INDEX];

    if (typeof categoryValue === 'number') {
        return categoryValue;
    }

    if (subcategory && typeof categoryValue === 'object' && categoryValue !== null) {
        const value = (categoryValue as any)[subcategory];
        if (typeof value === 'number') {
            return value;
        }
    }

    throw new Error(`Invalid z-index path: ${category}${subcategory ? `.${subcategory}` : ''}`);
}

/**
 * Tailwind-compatible z-index values as strings
 * Use these directly in className props
 */
export const Z_INDEX_CLASSES = {
    base: 'z-0',

    content: {
        raised: 'z-[1]',
        sticky: 'z-[5]',
    },

    interactive: {
        dropdown: 'z-[10]',
        tooltip: 'z-[15]',
        popover: 'z-[20]',
    },

    navigation: {
        header: 'z-[50]',
        sidebar: 'z-[55]',
        mobileMenu: 'z-[60]',
    },

    overlay: {
        backdrop: 'z-[90]',
        modal: 'z-[100]',
        sheet: 'z-[110]',
        drawer: 'z-[120]',
    },

    system: {
        toast: 'z-[500]',
        loading: 'z-[900]',
        debug: 'z-[999]',
    },

    emergency: 'z-[9999]',
} as const;