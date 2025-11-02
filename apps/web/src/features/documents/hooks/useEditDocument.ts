// nextjs/src/features/documents/hooks/useEditDocument.ts
import { useState } from "react";

import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { DocumentType } from "@interactions/types";

type EditDocumentData = {
    name: string;
    notes: string;
    type: DocumentType;
};

type EditDocumentParams = {
    id: string;
    data: EditDocumentData;
};

export function useEditDocument() {
    const [isLoading, setIsLoading] = useState(false);

    const editDocument = async ({ id, data }: EditDocumentParams): Promise<void> => {
        setIsLoading(true);
        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { error } = await client
                .from("documents")
                .update({
                    name: data.name.trim(),
                    notes: data.notes.trim(),
                    type: data.type,
                })
                .eq("id", id);

            if (error) {
                throw error;
            }
        } finally {
            setIsLoading(false);
        }
    };

    return {
        editDocument,
        isLoading,
    };
}