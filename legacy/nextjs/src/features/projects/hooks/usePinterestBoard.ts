// nextjs/src/features/projects/hooks/usePinterestBoard.ts

import { useState, useCallback } from 'react';
import { pinterestApi, type PinterestPin, isValidPinterestBoardUrl } from '@projects/lib/pinterestApi';

interface UsePinterestBoardReturn {
    pins: PinterestPin[];
    loading: boolean;
    error: string | null;
    loadBoard: (boardUrl: string) => Promise<void>;
    clearPins: () => void;
    isValidUrl: (url: string) => boolean;
}

export function usePinterestBoard(): UsePinterestBoardReturn {
    const [pins, setPins] = useState<PinterestPin[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadBoard = useCallback(async (boardUrl: string) => {
        if (!boardUrl.trim()) {
            setError('Board URL is required');
            return;
        }

        if (!isValidPinterestBoardUrl(boardUrl)) {
            setError('Invalid Pinterest board URL format');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const boardPins = await pinterestApi.getBoardPinsFromUrl(boardUrl);
            setPins(boardPins);
        } catch (err) {
            console.error('Failed to load Pinterest board:', err);

            if (err instanceof Error) {
                if (err.message.includes('access token')) {
                    setError('Pinterest API access token is not configured. Please contact your administrator.');
                } else if (err.message.includes('404')) {
                    setError('Board not found. Please check the URL and make sure the board is public.');
                } else if (err.message.includes('403')) {
                    setError('Access denied. The board might be private or you may not have permission to view it.');
                } else if (err.message.includes('429')) {
                    setError('Too many requests. Please wait a moment and try again.');
                } else {
                    setError(`Failed to load Pinterest board: ${err.message}`);
                }
            } else {
                setError('An unexpected error occurred while loading the Pinterest board.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const clearPins = useCallback(() => {
        setPins([]);
        setError(null);
    }, []);

    const isValidUrl = useCallback((url: string) => {
        return isValidPinterestBoardUrl(url);
    }, []);

    return {
        pins,
        loading,
        error,
        loadBoard,
        clearPins,
        isValidUrl,
    };
}