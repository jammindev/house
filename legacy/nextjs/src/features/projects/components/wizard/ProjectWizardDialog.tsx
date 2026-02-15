"use client";

import { useState } from "react";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ProjectDetailsStep } from "./ProjectDetailsStep";
import { DocumentUploadStep } from "./DocumentUploadStep";
import { AIPlanReviewStep } from "./AIPlanReviewStep";
import type { ProjectFormData, UploadedDocument, GeneratedPlan } from "../../types";
import { Button } from "@/components/ui/button";

interface ProjectWizardDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export type WizardStep = 1 | 2 | 3;

export function ProjectWizardDialog({
  open,
  onOpenChange,
  onSuccess,
  trigger = <Button>Open</Button>,
}: ProjectWizardDialogProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<ProjectFormData>({
    description: "",
    status: "draft",
    priority: 3,
    startDate: undefined,
    dueDate: undefined,
    tags: [],
    plannedBudget: undefined,
    zoneIds: [],
  });
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);

  const handleClose = () => {
    // Reset state when closing
    setStep(1);
    setFormData({
      description: "",
      status: "draft",
      priority: 3,
      startDate: undefined,
      dueDate: undefined,
      tags: [],
      plannedBudget: undefined,
      zoneIds: [],
    });
    setDocuments([]);
    setGeneratedPlan(null);
    onOpenChange?.(false);
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess?.();
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return t("projects.wizard.step1");
      case 2:
        return t("projects.wizard.step2");
      case 3:
        return t("projects.wizard.step3");
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return t("projects.wizard.step1Description");
      case 2:
        return t("projects.wizard.step2Description");
      case 3:
        return t("projects.wizard.step3Description");
    }
  };

  return (
    <SheetDialog
      trigger={trigger as React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>}
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          onOpenChange?.(true);
        }
      }}
      title={t("projects.wizard.title")}
      description={t("projects.wizard.subtitle")}
      closeLabel={t("projects.wizard.cancel")}
      minHeight="80vh"
    >
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step === stepNum
                  ? "bg-primary text-primary-foreground"
                  : step > stepNum
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {stepNum}
            </div>
            {stepNum < 3 && (
              <div
                className={`w-16 h-0.5 ${
                  step > stepNum ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h3 className="font-semibold">{getStepTitle()}</h3>
        <p className="text-sm text-muted-foreground">{getStepDescription()}</p>
      </div>

      {step === 1 && (
        <ProjectDetailsStep
          formData={formData}
          onUpdate={setFormData}
          onNext={() => setStep(2)}
          onCancel={handleClose}
        />
      )}

      {step === 2 && (
        <DocumentUploadStep
          documents={documents}
          onUpdate={setDocuments}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          onCancel={handleClose}
        />
      )}

      {step === 3 && (
        <AIPlanReviewStep
          formData={formData}
          documents={documents}
          generatedPlan={generatedPlan}
          onPlanGenerated={setGeneratedPlan}
          onPlanUpdated={setGeneratedPlan}
          onBack={() => setStep(2)}
          onCancel={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </SheetDialog>
  );
}
