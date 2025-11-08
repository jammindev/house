// nextjs/src/features/documents/hooks/useDocumentHighlight.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export function useDocumentHighlight(duration = 6000) {
    const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

    const highlightDocuments = useCallback((ids: string[]) => {
        setHighlightedIds(ids);
    }, []);

    const clearHighlights = useCallback(() => {
        setHighlightedIds([]);
    }, []);

    useEffect(() => {
        if (!highlightedIds.length) return;

        const timeout = setTimeout(() => {
            setHighlightedIds([]);
        }, duration);

        return () => clearTimeout(timeout);
    }, [highlightedIds, duration]);

    return {
        highlightedIds,
        highlightDocuments,
        clearHighlights,
        isHighlighted: useCallback((id: string) => highlightedIds.includes(id), [highlightedIds]),
    };
}