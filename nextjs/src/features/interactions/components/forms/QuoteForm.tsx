// nextjs/src/features/interactions/components/forms/QuoteForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import BaseInteractionFields from "./common/BaseInteractionFields";
import DocumentsFields, { type LocalFile } from "./common/DocumentsFields";
import ContactSelector from "@interactions/components/ContactSelector";
import StructureSelector from "@interactions/components/StructureSelector";
import { getCurrentLocalDateTimeInput } from "@interactions/utils/datetime";
import { parseAmountInput } from "@interactions/utils/amount";
import type { Document, InteractionStatus, ZoneOption } from "@interactions/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useContacts } from "@contacts/hooks/useContacts";
import { useStructures } from "@structures/hooks/useStructures";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";

interface QuoteFormDefaults {
    status?: InteractionStatus | "";
    occurredAt?: string;
    projectId?: string | null;
    subject?: string;
    content?: string;
}

interface QuoteFormProps {
    zones: ZoneOption[];
    zonesLoading?: boolean;
    onCreated?: (interactionId: string) => void;
    defaultValues?: QuoteFormDefaults;
    redirectOnSuccess?: boolean;
    redirectTo?: string | null;
    allowContentPrefill?: boolean;
    initialFiles?: LocalFile[];
}

const sanitizeFilename = (value: string) => value.replace(/[^0-9a-zA-Z._-]/g, "_");

export default function QuoteForm({
    zones,
    zonesLoading = false,
    onCreated,
    defaultValues = {},
    redirectOnSuccess = true,
    redirectTo = null,
    allowContentPrefill = true,
    initialFiles = [],
}: QuoteFormProps) {
    const router = useRouter();
    const { selectedHouseholdId: householdId } = useGlobal();
    const { show } = useToast();
    const { t } = useI18n();
    const { contacts } = useContacts();
    const { structures } = useStructures();

    const initialOccurredAt = useMemo(
        () => defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
        [defaultValues.occurredAt]
    );

    // Base form state
    const [subject, setSubject] = useState(defaultValues.subject ?? "");
    const [subjectDirty, setSubjectDirty] = useState(Boolean(defaultValues.subject));
    const [content, setContent] = useState(allowContentPrefill ? defaultValues.content ?? "" : "");
    const [status, setStatus] = useState<InteractionStatus | "">(defaultValues.status ?? "pending");
    const [occurredAt, setOccurredAt] = useState<string>(initialOccurredAt);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultValues.projectId ?? null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [selectedStructureIds, setSelectedStructureIds] = useState<string[]>([]);

    // Quote specific
    const [quoteAmount, setQuoteAmount] = useState("");

    // Files and documents
    const [files, setFiles] = useState<LocalFile[]>(initialFiles);
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

    // Auto subject generation for quotes
    const primaryStructureName = useMemo(() => {
        if (!selectedStructureIds.length) return null;
        const match = structures.find((item) => item.id === selectedStructureIds[0]);
        return match?.name?.trim() || null;
    }, [selectedStructureIds, structures]);

    const primaryContactName = useMemo(() => {
        if (!selectedContactIds.length) return null;
        const match = contacts.find((item) => item.id === selectedContactIds[0]);
        const first = match?.first_name?.trim() ?? "";
        const last = match?.last_name?.trim() ?? "";
        const full = `${first} ${last}`.trim();
        if (full) return full;
        return match?.structure?.name?.trim() ?? null;
    }, [contacts, selectedContactIds]);

    const selectedProjectName = useMemo(() => {
        if (!selectedProjectId) return null;
        const match = projectOptions.find((project) => project.id === selectedProjectId);
        return match?.title?.trim() || null;
    }, [projectOptions, selectedProjectId]);

    const autoSubject = useMemo(() => {
        const entityName = primaryStructureName ?? primaryContactName;
        if (!entityName || !selectedProjectName) return null;
        return t("interactionsquoteAutoSubject", {
            project: selectedProjectName,
            entity: entityName,
        });
    }, [primaryContactName, primaryStructureName, selectedProjectName, t]);

    useEffect(() => {
        if (!autoSubject) return;
        if (subjectDirty) return;
        if (subject === autoSubject) return;
        setSubject(autoSubject);
    }, [autoSubject, subject, subjectDirty]);

    const resetForm = () => {
        setSubject(defaultValues.subject ?? "");
        setSubjectDirty(Boolean(defaultValues.subject));
        setContent(allowContentPrefill ? defaultValues.content ?? "" : "");
        setStatus(defaultValues.status ?? "pending");
        setOccurredAt(defaultValues.occurredAt ?? getCurrentLocalDateTimeInput());
        setSelectedProjectId(defaultValues.projectId ?? null);
        setSelectedTagIds([]);
        setSelectedZones([]);
        setSelectedContactIds([]);
        setSelectedStructureIds([]);
        setQuoteAmount("");
        setFiles(initialFiles);
        setLibraryDocuments([]);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting) return;

        const trimmedContent = content.trim();
        const effectiveSubject = !subjectDirty && autoSubject ? autoSubject : subject;
        const trimmedSubject = effectiveSubject.trim() || trimmedContent.slice(0, 80);
        const contentPayload = trimmedContent.length > 0 ? trimmedContent : null;

        if (!trimmedSubject) {
            setError(t("interactionssubjectRequired"));
            return;
        }

        if (!selectedZones.length) {
            setError(t("interactionsselectZoneRequired"));
            return;
        }

        if (selectedStructureIds.length === 0 && selectedContactIds.length === 0) {
            setError(t("interactionsquoteAssociationRequired"));
            return;
        }

        const trimmedAmount = quoteAmount.trim();
        if (!trimmedAmount) {
            setError(t("interactionsamountRequired"));
            return;
        }
        const parsedAmount = parseAmountInput(trimmedAmount);
        if (parsedAmount === null) {
            setError(t("interactionsamountInvalid"));
            return;
        }

        const metadataPayload = { amount: parsedAmount };

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
                p_type: "quote",
                p_status: status || null,
                p_occurred_at: occurredAtValue,
                p_tag_ids: selectedTagIds.length ? selectedTagIds : null,
                p_contact_ids: selectedContactIds.length ? selectedContactIds : null,
                p_structure_ids: selectedStructureIds.length ? selectedStructureIds : null,
                p_project_id: selectedProjectId ?? null,
                p_metadata: metadataPayload,
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
                                    uploadSource: "quote_form",
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
                isAutoSubjectType={true}
                subjectPlaceholder={t("forms.quote.subjectPlaceholder")}
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

            {/* Quote-specific fields */}
            <Card>
                <CardHeader className="space-y-1">
                    <CardTitle className="text-lg font-semibold">{t("forms.quote.specificFields")}</CardTitle>
                    <CardDescription>{t("forms.quote.specificFieldsDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="quote-amount">
                            {t("interactionsamountLabel")}
                        </label>
                        <Input
                            id="quote-amount"
                            value={quoteAmount}
                            onChange={(event) => setQuoteAmount(event.target.value)}
                            placeholder={t("interactionsamountPlaceholder")}
                        />
                        <p className="text-xs text-gray-500">{t("interactionsamountHelper")}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">{t("interactionscontacts.label")}</label>
                        <p className="text-xs text-gray-500">{t("forms.quote.contactsHelper")}</p>
                        <ContactSelector
                            householdId={householdId || ""}
                            value={selectedContactIds}
                            onChange={setSelectedContactIds}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">{t("interactionsstructures.label")}</label>
                        <p className="text-xs text-gray-500">{t("forms.quote.structuresHelper")}</p>
                        <StructureSelector
                            householdId={householdId || ""}
                            value={selectedStructureIds}
                            onChange={setSelectedStructureIds}
                        />
                    </div>
                </CardContent>
            </Card>

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
                    {submitting ? t("common.saving") : t("forms.quote.createCta")}
                </Button>
            </div>
        </form>
    );
}
