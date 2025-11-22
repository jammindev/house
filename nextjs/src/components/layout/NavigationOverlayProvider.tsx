"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface NavigationOverlayContextValue {
    showOverlay: () => void;
    hideOverlay: () => void;
    isVisible: boolean;
}

const NavigationOverlayContext = createContext<NavigationOverlayContextValue | undefined>(undefined);

export function NavigationOverlayProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);

    const showOverlay = useCallback(() => setIsVisible(true), []);
    const hideOverlay = useCallback(() => setIsVisible(false), []);

    useEffect(() => {
        // Any successful route change hides the overlay.
        setIsVisible(false);
    }, [pathname]);

    const value = useMemo(
        () => ({
            showOverlay,
            hideOverlay,
            isVisible,
        }),
        [showOverlay, hideOverlay, isVisible],
    );

    return (
        <NavigationOverlayContext.Provider value={value}>
            {children}
            <NavigationOverlay isVisible={isVisible} />
        </NavigationOverlayContext.Provider>
    );
}

export function useNavigationOverlay() {
    const context = useContext(NavigationOverlayContext);
    if (!context) {
        throw new Error("useNavigationOverlay must be used within a NavigationOverlayProvider");
    }
    return context;
}

function NavigationOverlay({ isVisible }: { isVisible: boolean }) {
    return (
        <div
            className={`fixed inset-0 lg:left-64 z-[1000] flex items-center justify-center transition-opacity duration-200 ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            aria-hidden={!isVisible}
        >
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/20 to-white/5 backdrop-blur-2xl backdrop-saturate-150" />
                <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_55%)]" />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-3 text-gray-700">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                <span className="text-sm font-medium">Chargement...</span>
            </div>
        </div>
    );
}
