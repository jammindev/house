import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Stepper from "@/components/ui/stepper";
import { Input } from "@/components/ui/input";
import BaseInteractionFields from "../../common/BaseInteractionFields";
import DocumentsFields, { type LocalFile } from "../../common/DocumentsFields";
import ContactStructureSelector from "@interactions/components/ContactStructureSelector";
import type { InteractionSubjectStrategy } from "@interactions/constants";
import type { Document, ZoneOption } from "@interactions/types";
import type { ProjectOption } from "../types";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface QuoteFormFieldsProps {
    subjectStrategy?: InteractionSubjectStrategy;
    subject: string;
    onSubjectChange: (value: string) => void;
    subjectDirty: boolean;
    subjectPlaceholder: string;
    occurredAt: string;
    onOccurredAtChange: (value: string) => void;
    selectedProjectId: string | null;
    onProjectChange: (value: string | null) => void;
    projectOptions: ProjectOption[];
    projectLoading: boolean;
    projectError: string;
    selectedTagIds: string[];
    onTagsChange: (value: string[]) => void;
    selectedZones: string[];
    onZonesChange: Dispatch<SetStateAction<string[]>>;
    zones: ZoneOption[];
    zonesLoading: boolean;
    hasZones: boolean;
    content: string;
    onContentChange: (value: string) => void;
    householdId: string | null;
    amount: string;
    onAmountChange: (value: string) => void;
    selectedContactIds: string[];
    onContactsChange: (value: string[]) => void;
    selectedStructureIds: string[];
    onStructuresChange: (value: string[]) => void;
    files: LocalFile[];
    onFilesChange: (value: LocalFile[]) => void;
    libraryDocuments: Document[];
    onLibraryDocumentsChange: (value: Document[]) => void;
    submitError: string | null;
    isSubmitting: boolean;
    submitLabel: string;
    steps: { id?: string; title: string; description?: string }[];
    currentStep: number;
    scopeStepIndex?: number;
    detailsStepIndex?: number;
    attachmentsStepIndex?: number;
    onNextStep: () => void;
    onPrevStep: () => void;
    isLastStep: boolean;
    canProceed: boolean;
    onSubmitClick: () => void;
}

export function QuoteFormFields({
    subjectStrategy = "auto",
    subject,
    onSubjectChange,
    subjectDirty,
    subjectPlaceholder,
    occurredAt,
    onOccurredAtChange,
    selectedProjectId,
    onProjectChange,
    projectOptions,
    projectLoading,
    projectError,
    selectedTagIds,
    onTagsChange,
    selectedZones,
    onZonesChange,
    zones,
    zonesLoading,
    hasZones,
    content,
    onContentChange,
    householdId,
    amount,
    onAmountChange,
    selectedContactIds,
    onContactsChange,
    selectedStructureIds,
    onStructuresChange,
    files,
    onFilesChange,
    libraryDocuments,
    onLibraryDocumentsChange,
    submitError,
    isSubmitting,
    submitLabel,
    steps,
    currentStep,
    scopeStepIndex = 1,
    detailsStepIndex = 2,
    attachmentsStepIndex = 3,
    onNextStep,
    onPrevStep,
    isLastStep,
    canProceed,
    onSubmitClick,
}: QuoteFormFieldsProps) {
    const { t } = useI18n();
    const showBaseFieldsUntilStep = scopeStepIndex ?? 1;
    const showDetailsStepAt = detailsStepIndex ?? 2;
    const showAttachmentsStepAt = attachmentsStepIndex ?? steps.length - 1;
    const isAutoSubject = subjectStrategy === "auto";

    return (
        <>
            <div className="space-y-4">
                <Stepper steps={steps} currentStep={currentStep} />

                {currentStep <= showBaseFieldsUntilStep ? (
                    <BaseInteractionFields
                        currentStep={currentStep}
                        subject={subject}
                        onSubjectChange={onSubjectChange}
                        subjectDirty={subjectDirty}
                        onSubjectDirtyChange={() => {}}
                        isAutoSubjectType={isAutoSubject}
                        subjectPlaceholder={subjectPlaceholder}
                        occurredAt={occurredAt}
                        onOccurredAtChange={onOccurredAtChange}
                        showOccurredAt={true}
                        selectedProjectId={selectedProjectId}
                        onProjectChange={onProjectChange}
                        projectOptions={projectOptions}
                        projectLoading={projectLoading}
                        projectError={projectError}
                        selectedTagIds={selectedTagIds}
                        onTagsChange={onTagsChange}
                        selectedZones={selectedZones}
                        onZonesChange={onZonesChange}
                        zones={zones}
                        zonesLoading={zonesLoading}
                        hasZones={hasZones}
                        content={content}
                        onContentChange={onContentChange}
                        householdId={householdId}
                    />
                ) : null}

                {currentStep === showDetailsStepAt ? (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-lg font-semibold">{t("forms.quote.specificFields")}</CardTitle>
                                <CardDescription>{t("forms.quote.specificFieldsDescription")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700" htmlFor="quote-amount">
                                        {t("interactionsamountLabel")}
                                    </label>
                                    <Input
                                        id="quote-amount"
                                        value={amount}
                                        onChange={(event) => onAmountChange(event.target.value)}
                                        placeholder={t("interactionsamountPlaceholder")}
                                    />
                                    <p className="text-xs text-gray-500">{t("interactionsamountHelper")}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {householdId ? (
                            <ContactStructureSelector
                                householdId={householdId}
                                selectedContactIds={selectedContactIds}
                                onContactsChange={onContactsChange}
                                selectedStructureIds={selectedStructureIds}
                                onStructuresChange={onStructuresChange}
                                title={t("forms.quote.contactsStructuresTitle")}
                                description={t("forms.quote.contactsStructuresDescription")}
                                contactsHelper={t("forms.quote.contactsHelper")}
                                structuresHelper={t("forms.quote.structuresHelper")}
                                autoFillStructure={true}
                            />
                        ) : null}
                    </div>
                ) : null}

                {currentStep === showAttachmentsStepAt ? (
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

export default QuoteFormFields;
