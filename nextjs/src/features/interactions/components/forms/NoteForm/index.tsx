// nextjs/src/features/interactions/components/forms/NoteForm/index.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";
import type { Document, ZoneOption } from "@interactions/types";
import { useProjectOptions } from "./hooks/useProjectOptions";
import { useEquipmentOptions } from "./hooks/useEquipmentOptions";
import { useNoteFormState } from "./hooks/useNoteFormState";
import { sanitizeFilename } from "./utils/sanitizeFilename";
import NoteFormFields from "./components/NoteFormFields";
import type { NoteFormDefaults, NoteFormValues } from "./types";
import type { LocalFile } from "../common/DocumentsFields";

interface NoteFormProps {
    zones: ZoneOption[];
    zonesLoading?: boolean;
    onCreated?: (interactionId: string) => void;
    defaultValues?: NoteFormDefaults;
    redirectOnSuccess?: boolean;
    redirectTo?: string | null;
}

export default function NoteForm({
    zones,
    zonesLoading = false,
    onCreated,
    defaultValues = {},
    redirectOnSuccess = true,
    redirectTo = null,
}: NoteFormProps) {
    const router = useRouter();
    const { selectedHouseholdId: householdId } = useGlobal();
    const { show } = useToast();
    const { t } = useI18n();

    const steps = useMemo(
        () => [
            { title: t("forms.note.steps.details"), description: t("forms.note.steps.detailsDescription") },
            { title: t("forms.note.steps.context"), description: t("forms.note.steps.contextDescription") },
            { title: t("forms.note.steps.attachments"), description: t("forms.note.steps.attachmentsDescription") },
        ],
        [t]
    );
    const lastStepIndex = steps.length - 1;

    const {
        form,
        subject,
        content,
        occurredAt,
        selectedProjectId,
        selectedEquipmentId,
        selectedTagIds,
        selectedZones,
        selectedContactIds,
        selectedStructureIds,
        subjectDirty,
        hasZones,
        isSubmitting,
        resetForm,
    } = useNoteFormState({ defaultValues, zones });

    const { projectOptions, projectLoading, projectError } = useProjectOptions(householdId, t);
    const { equipmentOptions, equipmentLoading, equipmentError } = useEquipmentOptions(householdId, t);

    const [files, setFiles] = useState<LocalFile[]>([]);
    const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    const canProceed = currentStep === 0 ? selectedZones.length > 0 && hasZones && !zonesLoading : true;
    const showProjectField = !selectedEquipmentId;
    const showEquipmentField = !selectedProjectId;
    const selectedProject = projectOptions.find((project) => project.id === selectedProjectId);
    const projectZoneIds = selectedProject?.zoneIds ?? [];
    const selectedEquipment = equipmentOptions.find((item) => item.id === selectedEquipmentId);
    const equipmentZoneId = selectedEquipment?.zoneId ?? null;
    const zonesLockedByProject = !!(selectedProjectId && projectZoneIds.length > 0);
    const zonesLockedByEquipment = !!(selectedEquipmentId && equipmentZoneId);
    const zonesLocked = zonesLockedByProject || zonesLockedByEquipment;

    useEffect(() => {
        if (!zonesLocked) return;
        const targetZones = zonesLockedByProject ? projectZoneIds : equipmentZoneId ? [equipmentZoneId] : [];
        form.setValue("zoneIds", targetZones, { shouldDirty: false });
    }, [equipmentZoneId, form, projectZoneIds, zonesLocked, zonesLockedByProject]);

    const handleNextStep = () => {
        if (currentStep === 0 && (!selectedZones.length || !hasZones || zonesLoading)) {
            setSubmitError(t("interactionsselectZoneRequired"));
            return;
        }
        setSubmitError(null);
        setCurrentStep((prev) => Math.min(prev + 1, lastStepIndex));
    };

    const handlePrevStep = () => {
        setSubmitError(null);
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const normalizeRichText = (value: string) => {
        const trimmed = value.trim();
        const plainText = trimmed.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
        return { trimmed, plainText };
    };

    const onSubmit = async (formValues: NoteFormValues) => {
        if (isSubmitting) return;
        if (currentStep < lastStepIndex) {
            handleNextStep();
            return;
        }

        const { trimmed: trimmedContent, plainText: contentText } = normalizeRichText(formValues.content || "");
        const trimmedSubject = formValues.subject.trim() || contentText.slice(0, 80);
        const contentPayload = contentText.length > 0 ? trimmedContent : null;

        if (formValues.projectId && formValues.equipmentId) {
            setSubmitError(t("interactionsprojectEquipmentExclusive"));
            return;
        }

        if (!trimmedSubject) {
            setSubmitError(t("interactionssubjectRequired"));
            return;
        }

        if (!formValues.zoneIds.length) {
            setSubmitError(t("interactionsselectZoneRequired"));
            return;
        }

        const effectiveZoneIds = zonesLockedByProject
            ? projectZoneIds
            : zonesLockedByEquipment && equipmentZoneId
                ? [equipmentZoneId]
                : formValues.zoneIds;

        setSubmitError(null);

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { data: userData, error: userError } = await client.auth.getUser();
            if (userError) throw userError;
            const userId = userData.user?.id;
            if (!userId) throw new Error(t("auth.notAuthenticated"));

            const occurredAtValue = new Date().toISOString();
            const effectiveProjectId = formValues.equipmentId ? null : formValues.projectId ?? null;
            const effectiveMetadata =
                formValues.equipmentId && householdId
                    ? { equipment_id: formValues.equipmentId, source: "note_form" }
                    : null;

            const { data: createdId, error: createError } = await (client as any).rpc("create_interaction_with_zones", {
                p_household_id: householdId,
                p_subject: trimmedSubject,
                p_zone_ids: effectiveZoneIds,
                p_content: contentPayload,
                p_type: "note",
                p_status: null,
                p_occurred_at: occurredAtValue,
                p_tag_ids: formValues.tagIds.length ? formValues.tagIds : null,
                p_contact_ids: formValues.contactIds.length ? formValues.contactIds : null,
                p_structure_ids: formValues.structureIds.length ? formValues.structureIds : null,
                p_project_id: effectiveProjectId,
                p_metadata: effectiveMetadata,
            });

            if (createError || !createdId) {
                throw createError ?? new Error(t("interactionscreateFailed"));
            }

            const interactionId = createdId as string;

            if (formValues.equipmentId) {
                const { error: equipmentLinkError } = await (client as any).from("equipment_interactions").insert({
                    equipment_id: formValues.equipmentId,
                    interaction_id: interactionId,
                    role: "log",
                    note: "",
                });
                if (equipmentLinkError) throw equipmentLinkError;
            }

            if (files.length > 0) {
                for (const item of files) {
                    try {
                        const compressionResult = await compressFileForUpload(item.file);
                        const fileForUpload = compressionResult.file;
                        const safeBaseName = sanitizeFilename(fileForUpload.name || item.file.name || "document");
                        const uniquePrefix =
                            crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
                                household_id: householdId,
                                metadata: {
                                    ...buildDocumentMetadata(item.file, compressionResult),
                                    uploadSource: "note_form",
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
            setFiles([]);
            setLibraryDocuments([]);
            setCurrentStep(0);
            onCreated?.(interactionId);
            if (redirectOnSuccess) {
                const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/app/interactions?created=1";
                router.push(target);
            }
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : t("interactionscreateFailed");
            setSubmitError(message);
            show({ title: t("interactionscreateFailed"), description: message, variant: "error" });
        }
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <NoteFormFields
                subject={subject}
                onSubjectChange={(value) => form.setValue("subject", value, { shouldDirty: true })}
                subjectDirty={subjectDirty}
                subjectPlaceholder={t("forms.note.subjectPlaceholder")}
                occurredAt={occurredAt}
                onOccurredAtChange={(value) => form.setValue("occurredAt", value, { shouldDirty: true })}
                selectedProjectId={selectedProjectId}
                onProjectChange={(value) => {
                    form.setValue("projectId", value, { shouldDirty: true });
                    if (value) {
                        form.setValue("equipmentId", null, { shouldDirty: true });
                    }
                }}
                projectOptions={projectOptions}
                projectLoading={projectLoading}
                projectError={projectError}
                showProject={showProjectField}
                projectReadonly={!!defaultValues.projectId}
                selectedEquipmentId={selectedEquipmentId}
                onEquipmentChange={
                    showEquipmentField && householdId
                        ? (value) => {
                            form.setValue("equipmentId", value, { shouldDirty: true });
                            if (value) {
                                form.setValue("projectId", null, { shouldDirty: true });
                            }
                        }
                        : undefined
                }
                equipmentOptions={equipmentOptions}
                equipmentLoading={equipmentLoading}
                equipmentError={equipmentError}
                selectedTagIds={selectedTagIds}
                onTagsChange={(value) => form.setValue("tagIds", value, { shouldDirty: true })}
                selectedContactIds={selectedContactIds}
                onContactsChange={(value) => form.setValue("contactIds", value, { shouldDirty: true })}
                selectedStructureIds={selectedStructureIds}
                onStructuresChange={(value) => form.setValue("structureIds", value, { shouldDirty: true })}
                showOccurredAt={false}
                selectedZones={selectedZones}
                onZonesChange={
                    zonesLocked
                        ? undefined
                        : (updater) => {
                            const current = selectedZones;
                            const nextValue = typeof updater === "function" ? updater(current) : updater;
                            form.setValue("zoneIds", nextValue, { shouldDirty: true });
                        }
                }
                zones={zones}
                zonesLoading={zonesLoading}
                hasZones={hasZones}
                zonesLocked={
                    zonesLocked
                        ? {
                            locked: true,
                            zoneNames: zones
                                .filter((zone) =>
                                    zonesLockedByProject
                                        ? projectZoneIds.includes(zone.id)
                                        : zonesLockedByEquipment && equipmentZoneId
                                            ? zone.id === equipmentZoneId
                                            : false
                                )
                                .map((zone) => zone.name),
                            helper: zonesLockedByProject
                                ? t("forms.note.projectZonesLocked")
                                : t("forms.note.equipmentZonesLocked"),
                        }
                        : undefined
                }
                content={content}
                onContentChange={(value) => form.setValue("content", value, { shouldDirty: true })}
                householdId={householdId}
                files={files}
                onFilesChange={setFiles}
                libraryDocuments={libraryDocuments}
                onLibraryDocumentsChange={setLibraryDocuments}
                submitError={submitError}
                isSubmitting={isSubmitting}
                submitLabel={isSubmitting ? t("common.saving") : t("forms.note.createCta")}
                steps={steps}
                currentStep={currentStep}
                onNextStep={handleNextStep}
                onPrevStep={handlePrevStep}
                isLastStep={currentStep === lastStepIndex}
                canProceed={canProceed}
                onSubmitClick={() => form.handleSubmit(onSubmit)()}
            />
        </form>
    );
}
