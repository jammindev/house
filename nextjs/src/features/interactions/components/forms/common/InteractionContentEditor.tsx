// nextjs/src/features/interactions/components/forms/common/InteractionContentEditor.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { Loader2, PencilLine, Sparkles, Undo2 } from "lucide-react";
import { AIContextBadge, AIHelperText } from "@ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TinyEditor } from "@/components/rich-text/TinyEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";

type ProjectContext = {
    id: string;
    title?: string;
    status?: string;
};

type InteractionContentEditorProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    textareaName?: string;
    placeholder?: string;
    aiEnabled?: boolean;
    projectContext?: ProjectContext | null;
    forceEditing?: boolean;
    onSave?: () => void | Promise<void>;
    saving?: boolean;
    saveDisabled?: boolean;
};

const hasHtmlTags = (input: string) => /<\/?[a-z][\s\S]*>/i.test(input);

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const normalizeHtml = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return "";

    // If Tiny-compatible HTML already exists, strip unsafe tags and return.
    if (hasHtmlTags(trimmed)) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, "text/html");
        doc.querySelectorAll("script,style").forEach((node) => node.remove());
        return doc.body.innerHTML.trim();
    }

    // Otherwise, treat as text and add basic paragraph/line breaks.
    const safeText = escapeHtml(trimmed);
    const paragraphs = safeText
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`);

    return paragraphs.length ? paragraphs.join("") : `<p>${safeText}</p>`;
};

export function InteractionContentEditor({
    id,
    value,
    onChange,
    textareaName,
    placeholder,
    aiEnabled = true,
    projectContext,
    forceEditing = false,
    onSave,
    saving,
    saveDisabled = false,
}: InteractionContentEditorProps) {
    const { t } = useI18n();
    const [isEditingState, setIsEditingState] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previousContent, setPreviousContent] = useState<string | null>(null);
    const [isSavingInternal, setIsSavingInternal] = useState(false);
    const [isTinyLoading, setIsTinyLoading] = useState(false);

    const isEditing = forceEditing || isEditingState;
    const hasContent = Boolean(value?.trim());

    const projectStatusLabel = useMemo(() => {
        if (!projectContext?.status) return null;
        const key = `projects.status.${projectContext.status}`;
        return t(key as any) ?? projectContext.status;
    }, [projectContext?.status, t]);

    const displayHtml = useMemo(
        () =>
            value?.trim()
                ? value
                : `<p class="text-muted-foreground">${t("interactionsrawPlaceholder")}</p>`,
        [t, value]
    );

    const handleSendToAI = useCallback(async () => {
        if (!aiPrompt.trim()) return;
        setIsSubmitting(true);
        setError(null);
        setPreviousContent(value || "");

        try {
            const response = await fetch("/api/interactions/ai-improve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: aiPrompt.trim(),
                    content: value,
                    projectId: projectContext?.id ?? null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error || t("interactions.editor.aiError"));
            }

            if (!data?.html) {
                throw new Error(t("interactions.editor.aiError"));
            }

            const sanitized = normalizeHtml(data.html);
            onChange(sanitized);
            setShowPrompt(false);
            setAiPrompt("");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("interactions.editor.aiError");
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    }, [aiPrompt, onChange, projectContext?.id, t, value]);

    const handleRestore = useCallback(() => {
        if (previousContent === null) return;
        onChange(previousContent);
        setPreviousContent(null);
    }, [onChange, previousContent]);

    const isSaving = saving ?? isSavingInternal;

    const handleSave = useCallback(async () => {
        if (!onSave || isSaving || saveDisabled) return;
        const shouldManage = saving === undefined;
        if (shouldManage) setIsSavingInternal(true);
        try {
            await onSave();
        } finally {
            if (shouldManage) setIsSavingInternal(false);
        }
    }, [isSaving, onSave, saveDisabled, saving]);

    return (
        <div className="space-y-3">
            {isEditing ? (
                <div>
                    <div className="space-y-3">
                        {isTinyLoading ? (
                            <div 
                                className="w-full rounded-lg border border-slate-200 overflow-hidden"
                                style={{ height: 520 }}
                                role="status"
                                aria-label={t("common.loading")}
                            >
                                <div className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 flex items-center gap-1 animate-pulse">
                                    <div className="h-7 w-7 bg-slate-200 rounded"></div>
                                    <div className="h-7 w-7 bg-slate-200 rounded"></div>
                                    <div className="w-px h-5 bg-slate-200 mx-1"></div>
                                    <div className="h-7 w-24 bg-slate-200 rounded"></div>
                                    <div className="w-px h-5 bg-slate-200 mx-1"></div>
                                    <div className="h-7 w-7 bg-slate-200 rounded"></div>
                                    <div className="h-7 w-7 bg-slate-200 rounded"></div>
                                    <div className="h-7 w-7 bg-slate-200 rounded"></div>
                                </div>
                                <div className="bg-white h-full"></div>
                            </div>
                        ) : null}
                        <TinyEditor
                            id={id}
                            value={value}
                            onChange={onChange}
                            textareaName={textareaName}
                            placeholder={placeholder}
                            height={520}
                            onInit={() => setIsTinyLoading(false)}
                        />

                        {aiEnabled ? (
                            <div className="space-y-1.5">
                                <div className="overflow-hidden">
                                    <div
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                            showPrompt
                                                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                                                : "grid-rows-[1fr] opacity-100"
                                        }`}
                                        aria-hidden={showPrompt}
                                    >
                                        <div className="min-h-0">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setShowPrompt(true);
                                                    setError(null);
                                                }}
                                                disabled={isSubmitting}
                                            >
                                                {t(hasContent ? "interactions.editor.aiCtaImprove" : "interactions.editor.aiCtaWrite")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-hidden">
                                    <div
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                            showPrompt
                                                ? "grid-rows-[1fr] opacity-100"
                                                : "grid-rows-[0fr] opacity-0 pointer-events-none"
                                        }`}
                                        aria-hidden={!showPrompt}
                                    >
                                        <div className="min-h-0 space-y-2 p-2">
                                            <div className="flex items-center justify-between gap-2">
                                            <label
                                                className="text-sm font-medium text-slate-900"
                                                htmlFor={`${id}-ai-prompt`}
                                            >
                                                {t(hasContent ? "interactions.editor.aiPromptLabelImprove" : "interactions.editor.aiPromptLabelWrite")}
                                            </label>
                                            {projectContext?.title ? (
                                                <AIContextBadge
                                                    label={projectContext.title}
                                                    meta={projectContext.status ? projectStatusLabel ?? undefined : undefined}
                                                    className="text-xs"
                                                />
                                            ) : null}
                                        </div>
                                        <Textarea
                                            id={`${id}-ai-prompt`}
                                            value={aiPrompt}
                                                onChange={(event) => setAiPrompt(event.target.value)}
                                                placeholder={t(hasContent ? "interactions.editor.aiPromptPlaceholderImprove" : "interactions.editor.aiPromptPlaceholderWrite")}
                                                rows={3}
                                                disabled={isSubmitting}
                                            />
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <AIHelperText>{t(hasContent ? "interactions.editor.aiHelperImprove" : "interactions.editor.aiHelperWrite")}</AIHelperText>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setShowPrompt(false);
                                                            setAiPrompt("");
                                                            setError(null);
                                                        }}
                                                        disabled={isSubmitting}
                                                    >
                                                        {t("common.cancel")}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={handleSendToAI}
                                                        disabled={!aiPrompt.trim() || isSubmitting}
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                                                {t("interactions.editor.aiWorking")}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                                                                {t(hasContent ? "interactions.editor.aiSendImprove" : "interactions.editor.aiSendGenerate")}
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            {error ? (
                                                <p className="text-xs text-rose-600" role="alert">
                                                    {error}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {previousContent !== null && previousContent !== value ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleRestore}
                                    disabled={isSubmitting}
                                >
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    {t("interactions.editor.aiRestore")}
                                </Button>
                            ) : null}
                            {onSave ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSubmitting || isSaving || saveDisabled}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {t("common.saving")}
                                        </>
                                    ) : (
                                        t("common.save")
                                    )}
                                </Button>
                            ) : null}
                            {!forceEditing && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsEditingState(false)}
                                    disabled={isSubmitting}
                                >
                                    {t("interactions.editor.backToPreview")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    className="w-full rounded-lg border border-dashed border-slate-300 bg-white p-4 text-left shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    onClick={() => {
                        setIsTinyLoading(true);
                        setIsEditingState(true);
                        setShowPrompt(false);
                        setError(null);
                    }}
                    aria-expanded={isEditing}
                >
                    <div
                        className="min-h-[96px] text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a:hover]:opacity-80 [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:border-l-4 [&_blockquote]:border-l-muted [&_blockquote]:bg-muted/10 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2.5 [&_li]:ml-4 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-1.5 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:rounded-md [&_code]:border [&_code]:border-border [&_code]:bg-muted/20 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-foreground"
                        dangerouslySetInnerHTML={{ __html: displayHtml }}
                    />
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <PencilLine className="h-4 w-4" aria-hidden="true" />
                        <span>{t("interactions.editor.readHint")}</span>
                    </div>
                </button>
            )}
        </div>
    );
}

export default InteractionContentEditor;
