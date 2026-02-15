// nextjs/src/features/qr-code/components/QRCodeDisplay.tsx
"use client";

import { cn } from '@/lib/utils';
import { useQRCode } from '../hooks/useQRCode';
import type { QRGenerationOptions } from '../lib/qr-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export interface QRCodeDisplayProps {
    value: string | null;
    options?: QRGenerationOptions;
    className?: string;
    alt?: string;
    fallback?: React.ReactNode;
}

export default function QRCodeDisplay({
    value,
    options,
    className,
    alt = "QR Code",
    fallback
}: QRCodeDisplayProps) {
    const { dataUrl, loading, error } = useQRCode(value, options);

    if (loading) {
        return (
            <Skeleton
                className={cn("aspect-square w-32", className)}
            />
        );
    }

    if (error) {
        return fallback || (
            <div className={cn(
                "aspect-square w-32 flex flex-col items-center justify-center",
                "border border-red-200 bg-red-50 rounded-lg text-red-600",
                className
            )}>
                <AlertCircle className="h-6 w-6 mb-1" />
                <span className="text-xs text-center px-2">QR Error</span>
            </div>
        );
    }

    if (!dataUrl || !value) {
        return fallback || (
            <div className={cn(
                "aspect-square w-32 flex items-center justify-center",
                "border border-gray-200 bg-gray-50 rounded-lg text-gray-400",
                className
            )}>
                <span className="text-xs">No QR Code</span>
            </div>
        );
    }

    return (
        <img
            src={dataUrl}
            alt={alt}
            className={cn("aspect-square w-32 object-contain", className)}
        />
    );
}