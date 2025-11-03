"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Composant qui fait automatiquement défiler vers le haut de la page
 * lors des changements de route dans l'application avec une animation fluide.
 */
export default function ScrollToTop() {
    const pathname = usePathname();

    useEffect(() => {
        // Petit délai pour laisser le temps à la page de se charger
        const timer = setTimeout(() => {
            // Scroll animé vers le haut
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
            });
        }, 100);

        return () => clearTimeout(timer);
    }, [pathname]);

    return null;
}