"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "../ui/spinner";
import { Z_INDEX_CLASSES } from "@/lib/design-tokens";

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
            className={`fixed inset-0 lg:left-64 ${Z_INDEX_CLASSES.system.loading} flex items-center justify-center  ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            aria-hidden={!isVisible}
        >
            <div className="absolute inset-0 overflow-hidden bg-glass">
            </div>
            <Spinner />
        </div>
    );
}
