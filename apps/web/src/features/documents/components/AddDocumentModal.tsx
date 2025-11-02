"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Document, DocumentType } from "@interactions/types";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";
import type { Database } from "@/lib/types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

type InteractionDocumentLinkRow = {
    interaction_id: string | null;
    role: string | null;
    note: string | null;
    created_at: string | null;
    document: DocumentRow | null;
};

export type StagedDocument = {
    id: string; // local id for list rendering
    file: File;
    name: string;
    type: DocumentType;
    notes?: string;
};

export type InsertedDocumentRow = {
    interaction_id: string;
    link_role: string | null;
    link_note: string | null;
    link_created_at: string;
    document: Document;
};

// ---- Helpers -------------------------------------------------------------
function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sanitizeFilename(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inferTypeFromFile(file: File): DocumentType {
    if (file.type?.startsWith("image/")) return "photo";
    const lower = file.name.toLowerCase();
    if (/(devis|quote)/i.test(lower)) return "quote";
    if (/(facture|invoice)/i.test(lower)) return "invoice";
    if (/(contrat|contract)/i.test(lower)) return "contract";
    return "other";
}

// Persist a set of staged docs into Supabase storage + DB
export async function persistDocuments(
    supabase: SupabaseClient<Database>,
    params: {
        householdId: string;
        interactionId: string;
        docs: StagedDocument[];
        bucketName?: string; // default: "documents"
        tableName?: string; // default: "documents"
    }
): Promise<InsertedDocumentRow[]> {
    const {
        householdId,
        interactionId,
        docs,
        bucketName = "documents",
        tableName = "documents",
    } = params;

    const inserted: InsertedDocumentRow[] = [];

    for (const d of docs) {
        const compressionResult = await compressFileForUpload(d.file);
        const fileForUpload = compressionResult.file;
        const path = `${householdId}/${interactionId}/${uid()}_${sanitizeFilename(
            fileForUpload.name || d.file.name
        )}`;

        const upload = await supabase.storage.from(bucketName).upload(path, fileForUpload, {
            cacheControl: "3600",
            upsert: false,
            contentType: fileForUpload.type || undefined,
        });
        if (upload.error) throw upload.error;

        // Insert the document row
        const { data: documentRow, error: documentError } = await supabase
            .from(tableName)
            .insert({
                household_id: householdId,
                type: d.type,
                file_path: path,
                mime_type: fileForUpload.type || null,
                name: d.name || d.file.name,
                notes: d.notes ?? "",
                metadata: {
                    ...buildDocumentMetadata(d.file, compressionResult),
                    uploadSource: "add_document_modal",
                },
            })
            .select("id, household_id, type, file_path, mime_type, name, notes, metadata, created_at, created_by")
            .single();

        if (documentError) throw documentError;

        const typedDocumentRow = documentRow as DocumentRow | null;
        const documentId = typedDocumentRow?.id;
        if (!typedDocumentRow || !documentId) throw new Error("Document creation failed");

        const { data: linkRow, error: linkError } = await supabase
            .from("interaction_documents")
            .insert({
                interaction_id: interactionId,
                document_id: documentId,
                role: "attachment",
                note: d.notes ?? "",
            })
            .select(
                `
                interaction_id,
                role,
                note,
                created_at,
                document:documents (
                    id,
                    household_id,
                    file_path,
                    name,
                    notes,
                    mime_type,
                    type,
                    metadata,
                    created_at,
                    created_by
                )
                `
            )
            .single();
        if (linkError) throw linkError;

        const typedLink = linkRow as InteractionDocumentLinkRow | null;
        const documentData = typedLink?.document;
        if (!documentData) {
            throw new Error("Document link failed");
        }
        const normalizedDocument: Document = {
            id: documentData.id,
            household_id: documentData.household_id,
            file_path: documentData.file_path,
            name: documentData.name ?? "",
            notes: documentData.notes ?? "",
            mime_type: documentData.mime_type ?? null,
            type: (documentData.type ?? "document") as DocumentType,
            metadata: documentData.metadata,
            created_at: documentData.created_at,
            created_by: documentData.created_by ?? null,
            interaction_id: typedLink?.interaction_id ?? interactionId,
            link_role: typedLink?.role ?? null,
            link_note: typedLink?.note ?? null,
            link_created_at: typedLink?.created_at ?? null,
        };

        inserted.push({
            interaction_id: typedLink?.interaction_id ?? interactionId,
            link_role: typedLink?.role ?? null,
            link_note: typedLink?.note ?? null,
            link_created_at: typedLink?.created_at ?? null,
            document: normalizedDocument,
        });
    }

    return inserted;
}

// ---- Component -----------------------------------------------------------
const ALL_DOCUMENT_TYPES: DocumentType[] = ["document", "photo", "quote", "invoice", "contract", "other"];
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    document: "Document",
    photo: "Photo",
    quote: "Devis",
    invoice: "Facture",
    contract: "Contrat",
    other: "Autre",
};

export function AddDocumentsModal(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supabase?: SupabaseClient<Database>;
    householdId: string;
    mode: "staging" | "immediate";
    interactionId?: string; // required if mode === "immediate"
    bucketName?: string; // default: "documents"
    tableName?: string; // default: "documents"
    multiple?: boolean; // default: true
    onStagedChange?: (docs: StagedDocument[]) => void; // used in staging mode
    onUploaded?: (rows: InsertedDocumentRow[]) => void; // used in immediate mode
    allowedTypes?: DocumentType[];
    defaultType?: DocumentType;
}) {
    const {
        open,
        onOpenChange,
        supabase,
        householdId,
        mode,
        interactionId,
        bucketName = "documents",
        tableName = "documents",
        multiple = true,
        onStagedChange,
        onUploaded,
        allowedTypes,
        defaultType,
    } = props;

    const [files, setFiles] = useState<StagedDocument[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const typeOptions = allowedTypes && allowedTypes.length > 0 ? allowedTypes : ALL_DOCUMENT_TYPES;
    const enforcedDefaultType = defaultType && typeOptions.includes(defaultType) ? defaultType : undefined;

    // Reset when opened/closed
    useEffect(() => {
        if (!open) {
            setFiles([]);
            setIsSubmitting(false);
            setError(null);
        }
    }, [open]);

    const inferInitialType = useCallback((file: File): DocumentType => {
        if (enforcedDefaultType) return enforcedDefaultType;
        const inferred = inferTypeFromFile(file);
        return typeOptions.includes(inferred) ? inferred : typeOptions[0];
    }, [enforcedDefaultType, typeOptions]);

    const addFromFileList = useCallback(
        (list: FileList | null) => {
            if (!list) return;
            const next: StagedDocument[] = [];
            Array.from(list).forEach((file) => {
                next.push({ id: uid(), file, name: file.name, type: inferInitialType(file) });
            });
            setFiles((prev) => (multiple ? [...prev, ...next] : next.slice(0, 1)));
        },
        [inferInitialType, multiple]
    );

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        addFromFileList(e.dataTransfer.files);
    }, [addFromFileList]);

    const handlePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        addFromFileList(e.target.files);
        // reset input so picking same file again re-triggers change
        if (inputRef.current) inputRef.current.value = "";
    }, [addFromFileList]);

    const removeOne = useCallback((id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const updateOne = useCallback((id: string, patch: Partial<StagedDocument>) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    }, []);

    const canSubmit = useMemo(() => files.length > 0 && !isSubmitting, [files.length, isSubmitting]);

    async function onSubmit() {
        setError(null);
        setIsSubmitting(true);
        try {
            if (mode === "staging") {
                onStagedChange?.(files);
                onOpenChange(false);
                return;
            }
            // immediate = persist now
            if (!interactionId) throw new Error("interactionId requis en mode 'immediate'");
            if (!supabase) throw new Error("supabase client requis en mode 'immediate'");
            const rows = await persistDocuments(supabase, {
                householdId,
                interactionId,
                docs: files,
                bucketName,
                tableName,
            });
            onUploaded?.(rows);
            onOpenChange(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Échec de l'enregistrement des documents";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    const title = mode === "staging" ? "Joindre des documents (étape)" : "Ajouter des documents";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg w-full p-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2 border-b">
                    <DialogTitle className="text-base">{title}</DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {/* Dropzone / Picker */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={handleDrop}
                        className="border border-dashed rounded-2xl p-4 text-center"
                    >
                        <p className="text-sm">Glisse-dépose des fichiers ici ou</p>
                        <div className="mt-2 flex justify-center">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    inputRef.current?.click();
                                }}
                            >
                                Choisir des fichiers
                            </Button>
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            onChange={handlePick}
                            multiple={multiple}
                            accept="image/*,application/pdf"
                        />
                    </div>

                    {/* Selected list */}
                    {files.length > 0 && (
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                            {files.map((f) => (
                                <div key={f.id} className="border rounded-xl p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <Input
                                                value={f.name}
                                                onChange={(e) => updateOne(f.id, { name: e.target.value })}
                                                className="truncate"
                                            />
                                            <p className="text-xs text-muted-foreground truncate mt-1">{f.file.name} • {(f.file.size / 1024).toFixed(0)} Ko</p>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => removeOne(f.id)}>
                                            Retirer
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                                        <div className="sm:col-span-1">
                                            <label className="text-xs text-muted-foreground">Type</label>
                                            <select
                                                value={typeOptions.includes(f.type) ? f.type : typeOptions[0]}
                                                onChange={(e) => {
                                                    const nextType = e.target.value as DocumentType;
                                                    if (typeOptions.includes(nextType)) {
                                                        updateOne(f.id, { type: nextType });
                                                    }
                                                }}
                                                className="mt-1 w-full border rounded-md h-9 px-3 text-sm bg-background"
                                                disabled={typeOptions.length === 1}
                                            >
                                                {typeOptions.map((option) => (
                                                    <option key={option} value={option}>
                                                        {DOCUMENT_TYPE_LABELS[option] ?? option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="text-xs text-muted-foreground">Notes (optionnel)</label>
                                            <Textarea
                                                value={f.notes ?? ""}
                                                onChange={(e) => updateOne(f.id, { notes: e.target.value })}
                                                className="mt-1"
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-destructive" role="alert">{error}</p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
                            {mode === "staging" ? "Ajouter à la liste" : isSubmitting ? "Envoi…" : `Téléverser (${files.length})`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default AddDocumentsModal;
