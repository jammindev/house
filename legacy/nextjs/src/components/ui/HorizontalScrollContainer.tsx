"use client";

import { ReactNode, Children, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HorizontalScrollContainerProps {
    children: ReactNode;
    className?: string;
    itemClassName?: string;
    itemWidth?: string;
    desktopColumns?: number;
    mobileOnly?: boolean;
}

// Fonction pour détecter les navigateurs mobiles
const isMobileBrowser = (): boolean => {
    if (typeof window === 'undefined') return false;

    const userAgent = window.navigator.userAgent.toLowerCase();

    // Détection spécifique des navigateurs mobiles
    const mobilePatterns = [
        /iphone/,           // iPhone Safari
        /ipad/,             // iPad Safari  
        /android.*mobile/,  // Android Chrome/Firefox mobile (pas tablet)
        /blackberry/,       // BlackBerry
        /windows phone/,    // Windows Phone
        /opera mini/,       // Opera Mini
        /iemobile/          // Internet Explorer Mobile
    ];

    return mobilePatterns.some(pattern => pattern.test(userAgent));
};

export default function HorizontalScrollContainer({
    children,
    className,
    itemClassName,
    itemWidth = "w-64",
    desktopColumns = 2,
    mobileOnly = true,
}: HorizontalScrollContainerProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(isMobileBrowser());
    }, []);

    // Helper pour générer les classes de colonnes
    const getGridColumnClass = (columns: number): string => {
        const columnMap: Record<number, string> = {
            1: "grid-cols-1",
            2: "grid-cols-2",
            3: "grid-cols-3",
            4: "grid-cols-4",
            5: "grid-cols-5",
            6: "grid-cols-6",
            7: "grid-cols-7",
            8: "grid-cols-8"
        };
        return columnMap[columns] || "grid-cols-4";
    };

    // Si mobileOnly est false, toujours utiliser le grid
    if (!mobileOnly) {
        return (
            <div className={cn(`grid ${getGridColumnClass(desktopColumns)} gap-2`, className)}>
                {Children.toArray(children).map((child, index) => (
                    <div key={index} className={itemClassName}>
                        {child}
                    </div>
                ))}
            </div>
        );
    }

    // Si c'est un navigateur mobile, utiliser le scroll horizontal
    if (isMobile) {
        return (
            <div className={cn("flex overflow-x-auto scrollbar-hide gap-3", className)}>
                {Children.toArray(children).map((child, index) => (
                    <div key={index} className={cn(`flex-shrink-0 ${itemWidth}`, itemClassName)}>
                        {child}
                    </div>
                ))}
            </div>
        );
    }

    // Sinon, utiliser le grid avec le nombre de colonnes spécifié (desktop)
    return (
        <div className={cn(`grid ${getGridColumnClass(desktopColumns)} gap-2`, className)}>
            {Children.toArray(children).map((child, index) => (
                <div key={index} className={itemClassName}>
                    {child}
                </div>
            ))}
        </div>
    );
}