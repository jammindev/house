"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "../ui/spinner";

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
                <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/35 to-white/10 backdrop-blur-[28px] backdrop-saturate-200" />
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_60%)]" />
            </div>
            <Spinner />
        </div>
    );
}
