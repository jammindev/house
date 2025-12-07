// nextjs/src/features/equipment/hooks/useEquipmentAudit.ts
"use client";

import { useEffect, useState } from "react";

type AuditUser = {
    id: string;
    username?: string | null;
    email?: string | null;
};

type EquipmentAudit = {
    created_by?: AuditUser | null;
    updated_by?: AuditUser | null;
};

export function useEquipmentAudit(equipmentId: string, updatedAt?: string) {
    const [audit, setAudit] = useState<EquipmentAudit>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!equipmentId) {
            setLoading(false);
            return;
        }

        let mounted = true;

        const fetchAudit = async () => {
            try {
                const response = await fetch(`/api/equipment/${equipmentId}/audit`);

                if (!response.ok) {
                    if (response.status === 404) {
                        console.warn("Equipment not found for audit");
                    } else {
                        console.error("Failed to fetch equipment audit:", response.statusText);
                    }
                    if (mounted) {
                        setAudit({ created_by: null, updated_by: null });
                    }
                    return;
                }

                const data = await response.json();

                if (!mounted) return;

                setAudit({
                    created_by: data.created_by,
                    updated_by: data.updated_by,
                });
            } catch (error) {
                console.error("Error in useEquipmentAudit:", error);
                if (mounted) {
                    setAudit({ created_by: null, updated_by: null });
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchAudit();

        return () => {
            mounted = false;
        };
    }, [equipmentId, updatedAt]);

    return { audit, loading };
}