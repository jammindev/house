// nextjs/src/hooks/useZIndex.ts
import { useMemo } from 'react';
import { Z_INDEX, Z_INDEX_CLASSES, getZIndex } from '@/lib/design-tokens';

/**
 * Hook to easily access z-index values and classes
 * 
 * @example
 * const { zIndex, zClass } = useZIndex();
 * 
 * // Get numeric value
 * const modalZ = zIndex.overlay.modal; // 100
 * 
 * // Get Tailwind class
 * const modalClass = zClass.overlay.modal; // 'z-[100]'
 * 
 * // Use in className
 * <div className={`fixed inset-0 ${zClass.overlay.backdrop}`}>
 */
export function useZIndex() {
    const zIndex = useMemo(() => Z_INDEX, []);
    const zClass = useMemo(() => Z_INDEX_CLASSES, []);

    return {
        /**
         * Numeric z-index values
         */
        zIndex,

        /**
         * Tailwind z-index classes
         */
        zClass,

        /**
         * Helper to get z-index value by path
         * @example getZ('overlay', 'modal') // 100
         */
        getZ: getZIndex,

        /**
         * Helper to create a Tailwind arbitrary z-index class
         * @example createZClass(150) // 'z-[150]'
         */
        createZClass: (value: number) => `z-[${value}]`,

        /**
         * Helper to create a CSS z-index style
         * @example createZStyle(150) // { zIndex: 150 }
         */
        createZStyle: (value: number) => ({ zIndex: value }),
    };
}