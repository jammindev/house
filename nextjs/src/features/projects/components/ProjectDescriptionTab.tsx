// nextjs/src/features/projects/components/ProjectDescriptionTab.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Sparkles, Info, Loader2 } from "lucide-react";
import type { ProjectWithMetrics } from "@projects/types";
import { useState } from "react";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { generateProjectDescription } from "@projects/lib/generateDescription";
import { useToast } from "@/components/ToastProvider";
import { Textarea } from "@/components/ui/textarea";
import MarkdownContent from "@/components/ui/MarkdownContent";

interface ProjectDescriptionTabProps {
    project: ProjectWithMetrics;
    onDescriptionUpdated?: (newDescription: string) => void;
}

export default function ProjectDescriptionTab({
    project,
    onDescriptionUpdated
}: ProjectDescriptionTabProps) {
    const { t } = useI18n();
    const { show } = useToast();
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [additionalInstructions, setAdditionalInstructions] = useState("");
    const hasDescription = project.description && project.description.trim().length > 0;

    const handleGenerateDescription = async (instructions?: string) => {
        setIsGenerating(true);
        setIsPromptOpen(false);
        try {
            const action = hasDescription ? 'update' : 'generate';
            const result = await generateProjectDescription(project.id, action, instructions);

            if (result.success && result.description) {
                onDescriptionUpdated?.(result.description);
                show({
                    title: t(hasDescription ? 'projects.descriptionUpdated' : 'projects.descriptionGenerated'),
                    variant: 'success'
                });
            } else {
                show({
                    title: result.error || t('projects.descriptionError'),
                    variant: 'error'
                });
            }
        } catch (error) {
            console.error('Error generating description:', error);
            show({
                title: t('projects.descriptionError'),
                variant: 'error'
            });
        } finally {
            setIsGenerating(false);
            setAdditionalInstructions("");
        }
    };

    const openPromptDialog = () => {
        setIsPromptOpen(true);
    };

    const handleConfirmGeneration = () => {
        handleGenerateDescription(additionalInstructions.trim() || undefined);
    };

    return (
        <div className="space-y-6">
            {hasDescription ? (
                <div className="space-y-3">
                    <div className="">
                        <MarkdownContent className="text-slate-700">
                            {project.description}
                        </MarkdownContent>
                    </div>
                </div>
            ) : (
                <div className="text-center">
                    <div className="text-slate-400 text-sm mb-1">📝</div>
                    <div className="text-slate-600 text-sm font-medium">
                        {t("projects.noDescription")}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-700"
                    onClick={openPromptDialog}
                    disabled={isGenerating}
                >
                    {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="h-4 w-4" />
                    )}
                    {isGenerating
                        ? t('projects.generating')
                        : hasDescription
                            ? t("projects.updateWithAI")
                            : t("projects.generateWithAI")
                    }
                </Button>
                <SheetDialog
                    open={isInfoOpen}
                    onOpenChange={setIsInfoOpen}
                    title={t("projects.aiInfo.title")}
                    description={t("projects.aiInfo.description")}
                    trigger={
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto text-slate-400 hover:text-slate-600"
                        >
                            <Info className="h-4 w-4" />
                        </Button>
                    }
                >
                    <div className="p-4">
                        {/* Contenu additionnel si nécessaire */}
                    </div>
                </SheetDialog>
            </div>

            {/* SheetDialog for additional instructions */}
            <SheetDialog
                open={isPromptOpen}
                onOpenChange={setIsPromptOpen}
                title={hasDescription ? t("projects.updateWithAI") : t("projects.generateWithAI")}
                description={t("projects.additionalInstructionsHelper")}
                trigger={
                    <div style={{ display: 'none' }} />
                }
            >
                <div className="space-y-4 p-4">
                    <Textarea
                        placeholder={t("projects.additionalInstructionsPlaceholder")}
                        value={additionalInstructions}
                        onChange={(e) => setAdditionalInstructions(e.target.value)}
                        rows={4}
                        className="resize-none"
                    />
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsPromptOpen(false)}
                            disabled={isGenerating}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            onClick={handleConfirmGeneration}
                            disabled={isGenerating}
                            className="flex items-center gap-2"
                        >
                            {isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {isGenerating
                                ? t('projects.generating')
                                : hasDescription
                                    ? t("projects.updateWithAI")
                                    : t("projects.generateWithAI")
                            }
                        </Button>
                    </div>
                </div>
            </SheetDialog>
        </div>
    );
}