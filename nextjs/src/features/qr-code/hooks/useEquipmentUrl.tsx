// nextjs/src/features/qr-code/hooks/useEquipmentUrl.tsx
"use client";

import { useMemo } from 'react';
import { buildEquipmentUrl, buildPublicEquipmentUrl } from '../lib/qr-utils';

export interface UseEquipmentUrlOptions {
    publicAccess?: boolean;
    householdId?: string;
}

export function useEquipmentUrl(
    equipmentId: string | null,
    options: UseEquipmentUrlOptions = {}
): string | null {
    return useMemo(() => {
        if (!equipmentId) return null;

        const { publicAccess = false, householdId } = options;

        if (publicAccess) {
            return buildPublicEquipmentUrl(equipmentId, householdId);
        }

        return buildEquipmentUrl(equipmentId);
    }, [equipmentId, options.publicAccess, options.householdId]);
}