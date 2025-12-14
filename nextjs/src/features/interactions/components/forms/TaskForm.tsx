// nextjs/src/features/interactions/components/forms/TaskForm.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { buildDocumentMetadata, compressFileForUpload } from "@documents/utils/fileCompression";
import { INTERACTION_FORM_CONFIG } from "@interactions/constants";
import type { Document, ZoneOption } from "@interactions/types";
import { useProjectOptions } from "./NoteForm/hooks/useProjectOptions";
import TaskFormFields from "./TaskForm/components/TaskFormFields";
import type { TaskFormDefaults, TaskFormValues } from "./TaskForm/types";
import type { LocalFile } from "./common/DocumentsFields";
import { useTaskFormState } from "./TaskForm/hooks/useTaskFormState";
import { sanitizeFilename } from "./TaskForm/utils/sanitizeFilename";
import { useToast } from "@/components/ToastProvider";

interface TaskFormProps {
    zones: ZoneOption[];
    zonesLoading?: boolean;
    onCreated?: (interactionId: string) => void;
    defaultValues?: TaskFormDefaults;
    redirectOnSuccess?: boolean;
    redirectTo?: string | null;
}

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
    const { t } = useI18n();
    const { show } = useToast();

    const formConfig = INTERACTION_FORM_CONFIG.todo ?? INTERACTION_FORM_CONFIG.task ?? INTERACTION_FORM_CONFIG.note;

    const steps = useMemo(
        () =>
            formConfig?.steps?.(t) ?? [
                {
                    id: "basics",
                    title: t("forms.task.steps.basics"),
                    description: t("forms.task.steps.basicsDescription"),
                },
                {
                    id: "scope",
                    title: t("forms.task.steps.scope"),
                    description: t("forms.task.steps.scopeDescription"),
                },
                {
                    id: "context",
                    title: t("forms.task.steps.context"),
                    description: t("forms.task.steps.contextDescription"),
                },
                {
                    id: "attachments",
                    title: t("forms.task.steps.attachments"),
                    description: t("forms.task.steps.attachmentsDescription"),
                },
            ],
        [formConfig, t]
    );

    const requiredAssociations = formConfig?.requiredAssociations ?? {
        zones: true,
        contactsOrStructures: false,
        projectOrEquipmentExclusive: true,
    };
    const subjectStrategy = formConfig?.subjectStrategy ?? "manual";

    const scopeStepIndexFromConfig = steps.findIndex((step) => step.id === "scope");
    const scopeStepIndex = scopeStepIndexFromConfig >= 0 ? scopeStepIndexFromConfig : 1;
    const contextStepIndexFromConfig = formConfig?.ui?.contextStepIndex ?? steps.findIndex((step) => step.id === "context");
    const contextStepIndex = contextStepIndexFromConfig >= 0 ? contextStepIndexFromConfig : 2;
    const attachmentsStepIndexFromConfig =
        formConfig?.ui?.attachmentsStepIndex ?? steps.findIndex((step) => step.id === "attachments");
    const attachmentsStepIndex = attachmentsStepIndexFromConfig >= 0 ? attachmentsStepIndexFromConfig : steps.length - 1;
    const lastStepIndex = steps.length - 1;

    const {
        form,
        subject,
        content,
        occurredAt,
        status,
        selectedProjectId,
        selectedTagIds,
        selectedZones,
        selectedContactIds,
        selectedStructureIds,
        subjectDirty,
        hasZones,
        isSubmitting,
        resetForm,
    } = useTaskFormState({ defaultValues, zones });

    const { projectOptions, projectLoading, projectError } = useProjectOptions(householdId, t);

    const [files, setFiles] = useState<LocalFile[]>([]);
    const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    const canProceed =
        requiredAssociations.zones && currentStep === scopeStepIndex
            ? selectedZones.length > 0 && hasZones && !zonesLoading
            : requiredAssociations.contactsOrStructures && currentStep === contextStepIndex
                ? selectedContactIds.length > 0 || selectedStructureIds.length > 0
                : true;

    const handleNextStep = () => {
        if (
            requiredAssociations.zones &&
            currentStep === scopeStepIndex &&
            (!selectedZones.length || !hasZones || zonesLoading)
        ) {
            setSubmitError(t("interactionsselectZoneRequired"));
            return;
        }
        if (
            requiredAssociations.contactsOrStructures &&
            currentStep === contextStepIndex &&
            selectedContactIds.length + selectedStructureIds.length === 0
        ) {
            setSubmitError(t("interactionsquoteAssociationRequired"));
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

    const onSubmit = async (formValues: TaskFormValues) => {
        if (isSubmitting) return;
        if (currentStep < lastStepIndex) {
            handleNextStep();
            return;
        }

        const { trimmed: trimmedContent, plainText: contentText } = normalizeRichText(formValues.content || "");
        const trimmedSubject = formValues.subject.trim() || contentText.slice(0, 80);
        const contentPayload = contentText.length > 0 ? trimmedContent : null;

        if (!trimmedSubject) {
            setSubmitError(t("interactionssubjectRequired"));
            return;
        }

        if (requiredAssociations.zones && !formValues.zoneIds.length) {
            setSubmitError(t("interactionsselectZoneRequired"));
            return;
        }

        setSubmitError(null);

        try {
            const supa = await createSPASassClient();
            const client = supa.getSupabaseClient();

            const { data: userData, error: userError } = await client.auth.getUser();
            if (userError) throw userError;
            const userId = userData.user?.id;
            if (!userId) throw new Error(t("auth.notAuthenticated"));

            const occurredAtValue = formValues.occurredAt ? new Date(formValues.occurredAt).toISOString() : null;

            const { data: createdId, error: createError } = await (client as any).rpc("create_interaction_with_zones", {
                p_household_id: householdId,
                p_subject: trimmedSubject,
                p_zone_ids: formValues.zoneIds,
                p_content: contentPayload,
                p_type: "todo",
                p_status: formValues.status || null,
                p_occurred_at: occurredAtValue,
                p_tag_ids: formValues.tagIds.length ? formValues.tagIds : null,
                p_contact_ids: formValues.contactIds.length ? formValues.contactIds : null,
                p_structure_ids: formValues.structureIds.length ? formValues.structureIds : null,
                p_project_id: formValues.projectId ?? null,
                p_metadata: null,
            });

            if (createError || !createdId) {
                throw createError ?? new Error(t("interactionscreateFailed"));
            }

            const interactionId = createdId as string;

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
            <TaskFormFields
                subjectStrategy={subjectStrategy}
                subject={subject}
                onSubjectChange={(value) => form.setValue("subject", value, { shouldDirty: true })}
                subjectDirty={subjectDirty}
                subjectPlaceholder={t("forms.task.subjectPlaceholder")}
                occurredAt={occurredAt}
                onOccurredAtChange={(value) => form.setValue("occurredAt", value, { shouldDirty: true })}
                status={status}
                onStatusChange={(value) => form.setValue("status", value, { shouldDirty: true })}
                selectedProjectId={selectedProjectId}
                onProjectChange={(value) => form.setValue("projectId", value, { shouldDirty: true })}
                projectOptions={projectOptions}
                projectLoading={projectLoading}
                projectError={projectError}
                selectedTagIds={selectedTagIds}
                onTagsChange={(value) => form.setValue("tagIds", value, { shouldDirty: true })}
                selectedZones={selectedZones}
                onZonesChange={(updater) => {
                    const current = selectedZones;
                    const nextValue = typeof updater === "function" ? updater(current) : updater;
                    form.setValue("zoneIds", nextValue, { shouldDirty: true });
                }}
                zones={zones}
                zonesLoading={zonesLoading}
                hasZones={hasZones}
                content={content}
                onContentChange={(value) => form.setValue("content", value, { shouldDirty: true })}
                householdId={householdId}
                selectedContactIds={selectedContactIds}
                onContactsChange={(value) => form.setValue("contactIds", value, { shouldDirty: true })}
                selectedStructureIds={selectedStructureIds}
                onStructuresChange={(value) => form.setValue("structureIds", value, { shouldDirty: true })}
                files={files}
                onFilesChange={setFiles}
                libraryDocuments={libraryDocuments}
                onLibraryDocumentsChange={setLibraryDocuments}
                submitError={submitError}
                isSubmitting={isSubmitting}
                submitLabel={isSubmitting ? t("common.saving") : t("forms.task.createCta")}
                steps={steps}
                currentStep={currentStep}
                scopeStepIndex={scopeStepIndex}
                contextStepIndex={contextStepIndex}
                attachmentsStepIndex={attachmentsStepIndex}
                onNextStep={handleNextStep}
                onPrevStep={handlePrevStep}
                isLastStep={currentStep === lastStepIndex}
                canProceed={canProceed}
                onSubmitClick={() => form.handleSubmit(onSubmit)()}
            />
        </form>
    );
}
