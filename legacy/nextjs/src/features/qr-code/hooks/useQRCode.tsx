// nextjs/src/features/qr-code/hooks/useQRCode.tsx
"use client";

import { useEffect, useState } from 'react';
import { generateQRCode, type QRGenerationOptions } from '../lib/qr-utils';

export interface UseQRCodeResult {
    dataUrl: string | null;
    loading: boolean;
    error: string | null;
    regenerate: () => void;
}

/**
 * Hook to generate QR code data URL
 */
export function useQRCode(
    value: string | null,
    options: QRGenerationOptions = {}
): UseQRCodeResult {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        if (!value) {
            setDataUrl(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const url = await generateQRCode(value, options);
            setDataUrl(url);
        } catch (err) {
            console.error('QR Code generation failed:', err);
            setError(err instanceof Error ? err.message : 'QR code generation failed');
            setDataUrl(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        generate();
    }, [value, JSON.stringify(options)]);

    return {
        dataUrl,
        loading,
        error,
        regenerate: generate,
    };
}