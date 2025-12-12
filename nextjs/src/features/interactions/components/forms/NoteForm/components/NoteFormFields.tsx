import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Stepper from "@/components/ui/stepper";
import BaseInteractionFields from "../../common/BaseInteractionFields";
import DocumentsFields, { type LocalFile } from "../../common/DocumentsFields";
import ContactStructureSelector from "@interactions/components/ContactStructureSelector";
import InteractionTagsSelector from "@interactions/components/InteractionTagsSelector";
import type { Document, ZoneOption } from "@interactions/types";
import type { ProjectOption } from "../types";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface NoteFormFieldsProps {
    subject: string;
    onSubjectChange: (value: string) => void;
    subjectDirty: boolean;
    subjectPlaceholder: string;
    occurredAt: string;
    onOccurredAtChange: (value: string) => void;
    showOccurredAt?: boolean;
    selectedProjectId: string | null;
    onProjectChange: (value: string | null) => void;
    projectOptions: ProjectOption[];
    projectLoading: boolean;
    projectError: string;
    showProject?: boolean;
    projectReadonly?: boolean;
    selectedEquipmentId: string | null;
    onEquipmentChange: (value: string | null) => void;
    equipmentOptions: { id: string; name: string; status: string | null }[];
    equipmentLoading: boolean;
    equipmentError: string;
    selectedTagIds: string[];
    onTagsChange: (value: string[]) => void;
    selectedContactIds: string[];
    onContactsChange: (value: string[]) => void;
    selectedStructureIds: string[];
    onStructuresChange: (value: string[]) => void;
    selectedZones: string[];
    onZonesChange: Dispatch<SetStateAction<string[]>>;
    zones: ZoneOption[];
    zonesLoading: boolean;
    hasZones: boolean;
    zonesLocked?: { locked: boolean; zoneNames?: string[]; helper?: string };
    content: string;
    onContentChange: (value: string) => void;
    householdId: string | null;
    files: LocalFile[];
    onFilesChange: (value: LocalFile[]) => void;
    libraryDocuments: Document[];
    onLibraryDocumentsChange: (value: Document[]) => void;
    submitError: string | null;
    isSubmitting: boolean;
    submitLabel: string;
    steps: { title: string; description?: string }[];
    currentStep: number;
    onNextStep: () => void;
    onPrevStep: () => void;
    isLastStep: boolean;
    canProceed: boolean;
    onSubmitClick: () => void;
}

export function NoteFormFields({
    subject,
    onSubjectChange,
    subjectDirty,
    subjectPlaceholder,
    occurredAt,
    onOccurredAtChange,
    showOccurredAt = true,
    selectedProjectId,
    onProjectChange,
    projectOptions,
    projectLoading,
    projectError,
    showProject = true,
    projectReadonly = false,
    selectedEquipmentId,
    onEquipmentChange,
    equipmentOptions,
    equipmentLoading,
    equipmentError,
    selectedTagIds,
    onTagsChange,
    selectedContactIds,
    onContactsChange,
    selectedStructureIds,
    onStructuresChange,
    selectedZones,
    onZonesChange,
    zones,
    zonesLoading,
    hasZones,
    zonesLocked,
    content,
    onContentChange,
    householdId,
    files,
    onFilesChange,
    libraryDocuments,
    onLibraryDocumentsChange,
    submitError,
    isSubmitting,
    submitLabel,
    steps,
    currentStep,
    onNextStep,
    onPrevStep,
    isLastStep,
    canProceed,
    onSubmitClick,
}: NoteFormFieldsProps) {
    const { t } = useI18n();
    return (
        <>
            <div className="space-y-4">
                <Stepper steps={steps} currentStep={currentStep} />

                {currentStep === 0 ? (
                    <BaseInteractionFields
                        subject={subject}
                        onSubjectChange={onSubjectChange}
                        subjectDirty={subjectDirty}
                        onSubjectDirtyChange={() => { }}
                        isAutoSubjectType={false}
                        subjectPlaceholder={subjectPlaceholder}
                        occurredAt={occurredAt}
                        onOccurredAtChange={onOccurredAtChange}
                        showOccurredAt={showOccurredAt}
                        selectedProjectId={selectedProjectId}
                        onProjectChange={onProjectChange}
                        projectOptions={projectOptions}
                        projectLoading={projectLoading}
                        projectError={projectError}
                        showProject={showProject}
                        projectReadonly={projectReadonly}
                        selectedEquipmentId={selectedEquipmentId}
                        onEquipmentChange={onEquipmentChange}
                        equipmentOptions={equipmentOptions}
                        equipmentLoading={equipmentLoading}
                        equipmentError={equipmentError}
                        selectedTagIds={selectedTagIds}
                        onTagsChange={onTagsChange}
                        showTags={false}
                        selectedZones={selectedZones}
                        onZonesChange={onZonesChange}
                        zones={zones}
                        zonesLoading={zonesLoading}
                        hasZones={hasZones}
                        zonesLocked={zonesLocked}
                        content={content}
                        onContentChange={onContentChange}
                        householdId={householdId}
                    />
                ) : null}

                {currentStep === 1 ? (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-lg font-semibold">{t("interactionstagsLabel")}</CardTitle>
                                <CardDescription>{t("interactionstagsHelper")}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <InteractionTagsSelector
                                    householdId={householdId}
                                    value={selectedTagIds}
                                    onChange={onTagsChange}
                                    inputId="interaction-tags"
                                />
                            </CardContent>
                        </Card>

                        {householdId ? (
                            <ContactStructureSelector
                                householdId={householdId}
                                selectedContactIds={selectedContactIds}
                                onContactsChange={onContactsChange}
                                selectedStructureIds={selectedStructureIds}
                                onStructuresChange={onStructuresChange}
                                autoFillStructure={true}
                            />
                        ) : null}
                    </div>
                ) : null}

                {currentStep === 2 ? (
                    <DocumentsFields
                        files={files}
                        onFilesChange={onFilesChange}
                        libraryDocuments={libraryDocuments}
                        onLibraryDocumentsChange={onLibraryDocumentsChange}
                        householdId={householdId}
                    />
                ) : null}
            </div>

            {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {submitError}
                </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
                <div>
                    {currentStep > 0 ? (
                        <Button type="button" variant="ghost" onClick={onPrevStep} disabled={isSubmitting}>
                            {t("common.back")}
                        </Button>
                    ) : null}
                </div>
                <div className="flex gap-2">
                    {isLastStep ? (
                        <Button
                            type="button"
                            onClick={onSubmitClick}
                            disabled={isSubmitting || zonesLoading || !hasZones}
                        >
                            {submitLabel}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={onNextStep}
                            disabled={isSubmitting || !canProceed || zonesLoading || !hasZones}
                        >
                            {t("common.next")}
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}

export default NoteFormFields;
