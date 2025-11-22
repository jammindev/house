// nextjs/src/features/interactions/components/forms/TaskForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import BaseInteractionFields from "./common/BaseInteractionFields";
import DocumentsFields, { type LocalFile } from "./common/DocumentsFields";
import { getCurrentLocalDateTimeInput } from "@interactions/utils/datetime";
import type { Document, InteractionStatus, ZoneOption } from "@interactions/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";

interface TaskFormDefaults {
    status?: InteractionStatus | "";
    occurredAt?: string;
    projectId?: string | null;
}

interface TaskFormProps {
    zones: ZoneOption[];
    zonesLoading?: boolean;
    onCreated?: (interactionId: string) => void;
    defaultValues?: TaskFormDefaults;
    redirectOnSuccess?: boolean;
    redirectTo?: string | null;
}

const sanitizeFilename = (value: string) => value.replace(/[^0-9a-zA-Z._-]/g, "_");

export default function TaskForm({
    zones,
    zonesLoading = false,
    onCreated,
    defaultValues = {},
    redirectOnSuccess = true,
    redirectTo = null,
}: TaskFormProps) {
    const router = useRouter();
    const { selectedHouseholdId: householdId } = useGlobal();
    const { show } = useToast();
    const { t } = useI18n();

    const initialOccurredAt = useMemo(
        () => defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
        [defaultValues.occurredAt]
    );

    // Base form state
    const [subject, setSubject] = useState("");
    const [subjectDirty, setSubjectDirty] = useState(false);
    const [content, setContent] = useState("");
    const [status, setStatus] = useState<InteractionStatus | "">(defaultValues.status ?? "pending");
    const [occurredAt, setOccurredAt] = useState<string>(initialOccurredAt);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultValues.projectId ?? null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [selectedStructureIds, setSelectedStructureIds] = useState<string[]>([]);

    // Files and documents
    const [files, setFiles] = useState<LocalFile[]>([]);
    const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);

    // Form state
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Projects (simplified without types issues)
    const [projectOptions, setProjectOptions] = useState<Array<{ id: string; title: string; status: string }>>([]);
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectError, setProjectError] = useState("");

    // Load projects
    useEffect(() => {
        if (!householdId) {
            setProjectOptions([]);
            return;
        }
        let active = true;
        const loadProjects = async () => {
            setProjectLoading(true);
            setProjectError("");
            try {
                const supa = await createSPASassClient();
                const client = supa.getSupabaseClient();
                // Using raw query to avoid type issues
                const { data, error: loadError } = await (client as any)
                    .from("projects")
                    .select("id, title, status")
                    .eq("household_id", householdId)
                    .order("updated_at", { ascending: false })
                    .limit(100);
                if (loadError) throw loadError;
                if (!active) return;
                setProjectOptions(data ?? []);
            } catch (err: unknown) {
                if (!active) return;
                const message = err instanceof Error ? err.message : t("common.unexpectedError");
                setProjectError(message);
                setProjectOptions([]);
            } finally {
                if (active) setProjectLoading(false);
            }
        };
        void loadProjects();
        return () => {
            active = false;
        };
    }, [householdId, t]);

    const hasZones = zones.length > 0;

    const resetForm = () => {
        setSubject("");
        setSubjectDirty(false);
        setContent("");
        setStatus(defaultValues.status ?? "pending");
        setOccurredAt(defaultValues.occurredAt ?? getCurrentLocalDateTimeInput());
        setSelectedProjectId(defaultValues.projectId ?? null);
        setSelectedTagIds([]);
        setSelectedZones([]);
        setSelectedContactIds([]);
        setSelectedStructureIds([]);
        setFiles([]);
        setLibraryDocuments([]);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting) return;

        const trimmedContent = content.trim();
        const trimmedSubject = subject.trim() || trimmedContent.slice(0, 80);
        const contentPayload = trimmedContent.length > 0 ? trimmedContent : null;

        if (!trimmedSubject) {
            setError(t("interactionssubjectRequired"));
            return;
        }

        if (!selectedZones.length) {
            setError(t("interactionsselectZoneRequired"));
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { data: userData, error: userError } = await client.auth.getUser();
            if (userError) throw userError;
            const userId = userData.user?.id;
            if (!userId) throw new Error(t("auth.notAuthenticated"));

            const occurredAtValue = occurredAt ? new Date(occurredAt).toISOString() : null;

            // Using raw RPC call to avoid type issues
            const { data: createdId, error: createError } = await (client as any).rpc("create_interaction_with_zones", {
                p_household_id: householdId,
                p_subject: trimmedSubject,
                p_zone_ids: selectedZones,
                p_content: contentPayload,
                p_type: "todo",
                p_status: status || null,
                p_occurred_at: occurredAtValue,
                p_tag_ids: selectedTagIds.length ? selectedTagIds : null,
                p_contact_ids: selectedContactIds.length ? selectedContactIds : null,
                p_structure_ids: selectedStructureIds.length ? selectedStructureIds : null,
                p_project_id: selectedProjectId ?? null,
                p_metadata: null,
            });

            if (createError || !createdId) {
                throw createError ?? new Error(t("interactionscreateFailed"));
            }

            const interactionId = createdId as string;

            // Handle file uploads (simplified)
            if (files.length > 0) {
                for (const item of files) {
                    try {
                        const compressionResult = await compressFileForUpload(item.file);
                        const fileForUpload = compressionResult.file;
                        const safeBaseName = sanitizeFilename(fileForUpload.name || item.file.name || "document");
                        const uniquePrefix = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        const storagePath = `${userId}/${interactionId}/${uniquePrefix}_${safeBaseName}`;

                        const { error: uploadError } = await client.storage
                            .from("files")
                            .upload(storagePath, fileForUpload, {
                                cacheControl: "3600",
                                upsert: false,
                                contentType: fileForUpload.type || undefined,
                            });
                        if (uploadError) throw uploadError;

                        const { data: insertedDoc, error: docError } = await (client as any)
                            .from("documents")
                            .insert({
                                file_path: storagePath,
                                mime_type: fileForUpload.type || null,
                                type: item.type,
                                name: item.customName || item.file.name,
                                notes: item.notes ?? "",
                                metadata: {
                                    ...buildDocumentMetadata(item.file, compressionResult),
                                    uploadSource: "task_form",
                                },
                            })
                            .select("id")
                            .single();
                        if (docError) throw docError;
                        const documentId = insertedDoc?.id;
                        if (!documentId) throw new Error("Failed to create document");

                        const { error: linkError } = await (client as any).from("interaction_documents").insert({
                            interaction_id: interactionId,
                            document_id: documentId,
                            role: "attachment",
                            note: item.notes ?? "",
                        });
                        if (linkError) throw linkError;
                    } catch (fileError) {
                        console.warn("Failed to upload file:", item.file.name, fileError);
                    }
                }
            }

            // Handle library documents
            if (libraryDocuments.length > 0) {
                const existingPayload = libraryDocuments.map((doc) => ({
                    interaction_id: interactionId,
                    document_id: doc.id,
                    role: doc.link_role ?? "attachment",
                    note: doc.link_note ?? "",
                }));
                const { error: linkExistingError } = await (client as any)
                    .from("interaction_documents")
                    .upsert(existingPayload, { onConflict: "interaction_id,document_id" });
                if (linkExistingError) throw linkExistingError;
            }

            resetForm();
            onCreated?.(interactionId);
            if (redirectOnSuccess) {
                const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/app/interactions?created=1";
                router.push(target);
            }
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : t("interactionscreateFailed");
            setError(message);
            show({ title: t("interactionscreateFailed"), description: message, variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <BaseInteractionFields
                subject={subject}
                onSubjectChange={setSubject}
                subjectDirty={subjectDirty}
                onSubjectDirtyChange={setSubjectDirty}
                isAutoSubjectType={false}
                subjectPlaceholder={t("forms.task.subjectPlaceholder")}
                status={status}
                onStatusChange={setStatus}
                occurredAt={occurredAt}
                onOccurredAtChange={setOccurredAt}
                selectedProjectId={selectedProjectId}
                onProjectChange={setSelectedProjectId}
                projectOptions={projectOptions}
                projectLoading={projectLoading}
                projectError={projectError}
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
                selectedZones={selectedZones}
                onZonesChange={setSelectedZones}
                zones={zones}
                zonesLoading={zonesLoading}
                hasZones={hasZones}
                content={content}
                onContentChange={setContent}
                householdId={householdId}
            />

            <DocumentsFields
                files={files}
                onFilesChange={setFiles}
                libraryDocuments={libraryDocuments}
                onLibraryDocumentsChange={setLibraryDocuments}
                householdId={householdId}
            />

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-2">
                <Button type="submit" disabled={submitting || zonesLoading || !hasZones}>
                    {submitting ? t("common.saving") : t("forms.task.createCta")}
                </Button>
            </div>
        </form>
    );
}
