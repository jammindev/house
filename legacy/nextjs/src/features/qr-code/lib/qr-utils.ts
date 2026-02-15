// nextjs/src/features/qr-code/lib/qr-utils.ts
import QRCode from 'qrcode';
import type { QRCodeOptions } from '../types';

export interface QRGenerationOptions extends QRCodeOptions {
    format?: 'png' | 'svg';
}

/**
 * Generate QR code data URL for a given value
 */
export async function generateQRCode(
    value: string,
    options: QRGenerationOptions = {}
): Promise<string> {
    const {
        size = 256,
        color = { dark: '#000000', light: '#FFFFFF' },
        margin = 1,
        format = 'png'
    } = options;

    const qrOptions = {
        width: size,
        margin,
        color,
    };

    if (format === 'svg') {
        return QRCode.toString(value, {
            ...qrOptions,
            type: 'svg'
        });
    }

    return QRCode.toDataURL(value, qrOptions);
}

/**
 * Build equipment URL for QR code
 */
export function buildEquipmentUrl(equipmentId: string): string {
    // Use the current domain or fallback to a configurable base URL
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/app/equipment/${equipmentId}`;
    }

    // Fallback for server-side rendering
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.1.14:3000';
    return `${baseUrl}/app/equipment/${equipmentId}`;
}

/**
 * Create a public equipment access URL (for potential future use)
 */
export function buildPublicEquipmentUrl(equipmentId: string, householdId?: string): string {
    const baseUrl = buildEquipmentUrl(equipmentId);
    if (householdId) {
        return `${baseUrl}?h=${householdId}`;
    }
    return baseUrl;
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Get optimal QR code size based on content length
 */
export function getOptimalQRSize(content: string): number {
    if (content.length < 50) return 128;
    if (content.length < 100) return 192;
    if (content.length < 200) return 256;
    return 320;
}