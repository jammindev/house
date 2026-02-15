// nextjs/src/features/documents/utils/uploadHelpers.ts
import type { DocumentType } from "@interactions/types";

export function createLocalId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeFilename(name: string): string {
    return name.replace(/[^0-9a-zA-Z._-]/g, "_");
}

export function inferDocumentType(file: File): DocumentType {
    if (file.type?.startsWith("image/")) return "photo";
    const lower = file.name.toLowerCase();
    if (/(devis|quote)/i.test(lower)) return "quote";
    if (/(facture|invoice)/i.test(lower)) return "invoice";
    if (/(contrat|contract)/i.test(lower)) return "contract";
    return "document";
}

export function formatFileSize(bytes: number | undefined): string {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const DOCUMENT_TYPES: DocumentType[] = ["document", "photo", "quote", "invoice", "contract", "other"];