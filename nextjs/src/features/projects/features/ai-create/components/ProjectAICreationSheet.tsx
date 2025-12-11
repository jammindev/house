"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardPlus, Sparkles, TriangleAlert } from "lucide-react";
import { ProjectAIComposer, ProjectAIMessageList, type ProjectAIMessage } from "@projects/features/ai-chat";
import { PROJECT_TYPE_META, PROJECT_TYPES } from "@projects/constants";
import type { ProjectPriority, ProjectType } from "@projects/types";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PROJECT_INTAKE_LABELS, PROJECT_INTAKE_ORDER, PROJECT_INTAKE_QUESTIONS } from "../config";
import type { ProjectIntakeDraft, ProjectIntakeResponse, ProjectIntakeStep } from "../types";

type ProjectAICreationSheetProps = {
  trigger?: ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;
  onCreated?: (projectId: string) => void;
};

const DEFAULT_DRAFT: ProjectIntakeDraft = {
  title: "",
  description: "",
  type: "other",
  status: "draft",
  priority: 3,
  startDate: null,
  dueDate: null,
  plannedBudget: null,
  tags: [],
};

function normalizeType(answer: string): ProjectType {
  const lower = answer.toLowerCase();
  const direct = PROJECT_TYPES.find((type) => lower.includes(type));
  if (direct) return direct;

  if (lower.includes("travaux") || lower.includes("reno") || lower.includes("rénov")) return "renovation";
  if (lower.includes("maintenance") || lower.includes("entretien")) return "maintenance";
  if (lower.includes("repair") || lower.includes("repar") || lower.includes("fix") || lower.includes("panne")) return "repair";
  if (lower.includes("achat") || lower.includes("purchase") || lower.includes("buy") || lower.includes("commande")) return "purchase";
  if (lower.includes("demen") || lower.includes("move") || lower.includes("reloc")) return "relocation";
  if (lower.includes("vacance") || lower.includes("vacation") || lower.includes("holiday")) return "vacation";
  if (lower.includes("loisir") || lower.includes("leisure")) return "leisure";
  return "other";
}

function parseBudget(raw: string): number | null | "skip" | "error" {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "skip" || normalized === "aucun" || normalized === "none" || normalized === "non" || normalized === "pass") {
    return "skip";
  }
  const cleaned = normalized.replace(/[^\d.,-]/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (Number.isNaN(value)) return "error";
  return value;
}

function parseDateValue(raw: string): string | null | "skip" | "error" {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === "skip" || normalized === "aucune" || normalized === "pass" || normalized === "none") {
    return "skip";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "error";
  return raw.slice(0, 10);
}

function splitTags(raw: string): string[] {
  return raw
    .split(/[,#]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isStepComplete(draft: ProjectIntakeDraft, step: ProjectIntakeStep) {
  switch (step) {
    case "title":
      return Boolean(draft.title.trim());
    case "type":
      return Boolean(draft.type);
    case "startDate":
      return Boolean(draft.startDate);
    case "dueDate":
      return Boolean(draft.dueDate);
    case "plannedBudget":
      return draft.plannedBudget !== null && !Number.isNaN(draft.plannedBudget);
    case "tags":
      return draft.tags.length > 0;
    case "description":
      return Boolean(draft.description.trim());
    default:
      return false;
  }
}

export function ProjectAICreationSheet({ trigger, onCreated }: ProjectAICreationSheetProps) {
  const { t, locale } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { show } = useToast();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ProjectAIMessage[]>([]);
  const [draft, setDraft] = useState<ProjectIntakeDraft>(DEFAULT_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  const currentStep = PROJECT_INTAKE_ORDER[stepIndex] ?? null;
  const totalSteps = PROJECT_INTAKE_ORDER.length;

  const buildAssistantMessage = useCallback(
    (content: string): ProjectAIMessage => ({
      id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      thread_id: "project-intake",
      role: "assistant",
      content,
      metadata: {},
      created_at: new Date().toISOString(),
    }),
    []
  );

  const buildUserMessage = useCallback(
    (content: string): ProjectAIMessage => ({
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      thread_id: "project-intake",
      role: "user",
      content,
      metadata: {},
      created_at: new Date().toISOString(),
    }),
    []
  );

  const resetFlow = useCallback(() => {
    setDraft({ ...DEFAULT_DRAFT, tags: [] });
    setStepIndex(0);
    setError(null);
    setFallbackUsed(false);
    const welcome = buildAssistantMessage(t("projects.aiCreate.welcome"));
    setMessages([welcome]);
  }, [buildAssistantMessage, t]);

  useEffect(() => {
    if (isOpen) {
      resetFlow();
    }
  }, [isOpen, resetFlow]);

  const askAssistant = useCallback(
    async ({
      latestAnswer,
      step,
      nextStep,
      updatedDraft,
    }: {
      latestAnswer: string;
      step: ProjectIntakeStep | null;
      nextStep: ProjectIntakeStep | null;
      updatedDraft: ProjectIntakeDraft;
    }) => {
      if (!selectedHouseholdId) {
        return;
      }
      setIsThinking(true);
      setError(null);

      try {
        const response = await fetch("/api/projects/ai-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            householdId: selectedHouseholdId,
            locale,
            latestAnswer,
            step,
            nextStep,
            draft: updatedDraft,
          }),
        });

        const data: ProjectIntakeResponse = await response.json();
        const assistantText =
          data?.message ||
          (nextStep ? PROJECT_INTAKE_QUESTIONS[nextStep]?.[locale as "en" | "fr"] : t("projects.aiCreate.fallback"));

        setMessages((prev) => [...prev, buildAssistantMessage(assistantText)]);
        setFallbackUsed(Boolean(data?.fallbackUsed));

        if (!response.ok && data?.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error("Failed to ask assistant", err);
        setError(t("projects.aiCreate.assistantError"));
        setMessages((prev) => [
          ...prev,
          buildAssistantMessage(
            nextStep
              ? PROJECT_INTAKE_QUESTIONS[nextStep]?.[locale as "en" | "fr"] || t("projects.aiCreate.fallback")
              : t("projects.aiCreate.fallback"),
          ),
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [buildAssistantMessage, locale, selectedHouseholdId, t]
  );

  const handleSend = useCallback(
    async (value: string) => {
      if (isThinking || isSaving) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, buildUserMessage(trimmed)]);

      if (!selectedHouseholdId) {
        setError(t("projects.aiCreate.missingHousehold"));
        return;
      }

      const activeStep = currentStep ?? "description";
      const update: Partial<ProjectIntakeDraft> = {};
      let nextStep: ProjectIntakeStep | null = null;

      if (activeStep === "title") {
        update.title = trimmed;
      } else if (activeStep === "type") {
        const detectedType = normalizeType(trimmed);
        const defaults = PROJECT_TYPE_META[detectedType];
        update.type = detectedType;
        update.status = defaults?.defaults.status ?? "draft";
        update.priority = (defaults?.defaults.priority ?? 3) as ProjectPriority;
      } else if (activeStep === "startDate" || activeStep === "dueDate") {
        const parsed = parseDateValue(trimmed);
        if (parsed === "error") {
          setMessages((prev) => [...prev, buildAssistantMessage(t("projects.aiCreate.invalidDate"))]);
          return;
        }
        const valueToStore = parsed === "skip" ? null : parsed;
        update[activeStep] = valueToStore as string | null;
      } else if (activeStep === "plannedBudget") {
        const parsed = parseBudget(trimmed);
        if (parsed === "error") {
          setMessages((prev) => [...prev, buildAssistantMessage(t("projects.aiCreate.invalidBudget"))]);
          return;
        }
        update.plannedBudget = parsed === "skip" ? null : parsed;
      } else if (activeStep === "tags") {
        const tags = trimmed.toLowerCase() === "skip" ? [] : splitTags(trimmed);
        update.tags = tags;
      } else if (activeStep === "description") {
        update.description = draft.description
          ? `${draft.description}\n${trimmed}`.trim()
          : trimmed;
      }

      const updatedDraft: ProjectIntakeDraft = {
        ...draft,
        ...update,
      };
      setDraft(updatedDraft);

      const upcomingIndex = Math.min(stepIndex + 1, PROJECT_INTAKE_ORDER.length);
      nextStep = PROJECT_INTAKE_ORDER[upcomingIndex] ?? null;
      setStepIndex(upcomingIndex);

      await askAssistant({
        latestAnswer: trimmed,
        step: activeStep,
        nextStep,
        updatedDraft,
      });
    },
    [askAssistant, buildAssistantMessage, buildUserMessage, currentStep, draft, isSaving, isThinking, selectedHouseholdId, stepIndex, t]
  );

  const canCreate = Boolean(draft.title.trim()) && !isSaving && !isThinking;

  const handleCreate = useCallback(async () => {
    if (!selectedHouseholdId) {
      setError(t("projects.aiCreate.missingHousehold"));
      return;
    }
    if (!draft.title.trim()) {
      setError(t("projects.aiCreate.missingTitle"));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const { data, error: insertError } = await client
        .from("projects")
        .insert({
          household_id: selectedHouseholdId,
          title: draft.title.trim(),
          description: draft.description,
          status: draft.status,
          priority: draft.priority,
          type: draft.type,
          start_date: draft.startDate || null,
          due_date: draft.dueDate || null,
          planned_budget: draft.plannedBudget ?? 0,
          tags: draft.tags,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      const newId = data?.id;
      show({ title: t("projects.aiCreate.success"), variant: "success" });

      if (newId) {
        onCreated?.(newId);
        router.push(`/app/projects/${newId}`);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to create project", err);
      setError(t("projects.aiCreate.createError"));
    } finally {
      setIsSaving(false);
    }
  }, [draft, onCreated, router, selectedHouseholdId, show, t]);

  const defaultTrigger = (
    <Button size="sm" className="gap-2">
      <ClipboardPlus className="h-4 w-4" />
      {t("projects.aiCreate.trigger")}
    </Button>
  );

  const summaryItems = useMemo(
    () => PROJECT_INTAKE_ORDER.map((step) => {
      const label = PROJECT_INTAKE_LABELS[step]?.[locale as "en" | "fr"] ?? step;
      let value: string = "";
      if (step === "title") value = draft.title || t("projects.aiCreate.pending");
      if (step === "type") value = draft.type;
      if (step === "startDate") value = draft.startDate || t("projects.aiCreate.pending");
      if (step === "dueDate") value = draft.dueDate || t("projects.aiCreate.pending");
      if (step === "plannedBudget") value = draft.plannedBudget != null ? `${draft.plannedBudget}€` : t("projects.aiCreate.pending");
      if (step === "tags") value = draft.tags.length ? draft.tags.join(", ") : t("projects.aiCreate.pending");
      if (step === "description") value = draft.description || t("projects.aiCreate.pending");

      return { step, label, value, done: isStepComplete(draft, step) };
    }),
    [draft, locale, t]
  );

  return (
    <SheetDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={trigger || defaultTrigger}
      title={t("projects.aiCreate.title")}
      description={t("projects.aiCreate.subtitle")}
      contentClassName="p-0 gap-0"
      containerClassName="overflow-hidden"
      minHeight="520px"
    >
      {() => (
        <div className="grid h-full min-h-[520px] grid-cols-1 md:grid-cols-[1.6fr,1fr]">
          <div className="flex flex-col border-r">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{t("projects.aiCreate.flowTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("projects.aiCreate.flowSubtitle")}</p>
                </div>
              </div>
              <Badge variant="secondary">
                {t("projects.aiCreate.stepCount", { current: Math.min(stepIndex + 1, totalSteps), total: totalSteps })}
              </Badge>
            </div>

            {error ? (
              <Alert variant="destructive" className="m-3">
                <AlertTitle>{t("projects.aiCreate.errorTitle")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {fallbackUsed ? (
              <Alert className="mx-3 mt-2 border-amber-200 bg-amber-50">
                <AlertTitle className="text-amber-800 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4" />
                  {t("projects.aiCreate.fallbackTitle")}
                </AlertTitle>
                <AlertDescription className="text-amber-700">
                  {t("projects.aiCreate.fallbackDescription")}
                </AlertDescription>
              </Alert>
            ) : null}

            {!selectedHouseholdId ? (
              <Alert className="m-3">
                <AlertTitle>{t("projects.aiCreate.missingHouseholdTitle")}</AlertTitle>
                <AlertDescription>{t("projects.aiCreate.missingHousehold")}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex-1 min-h-0">
              <ProjectAIMessageList messages={messages} isStreaming={isThinking} isLoading={false} />
            </div>

            <div className="border-t p-3">
              <ProjectAIComposer
                onSendMessage={handleSend}
                isStreaming={isThinking}
                onCancel={() => setIsThinking(false)}
                disabled={isSaving || !selectedHouseholdId}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {currentStep ? PROJECT_INTAKE_QUESTIONS[currentStep]?.[locale as "en" | "fr"] : t("projects.aiCreate.readyToCreate")}
              </p>
            </div>
          </div>

          <div className="flex flex-col bg-muted/30 p-4 gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{t("projects.aiCreate.summaryTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("projects.aiCreate.summarySubtitle")}</p>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1">
              {summaryItems.map((item) => (
                <Card
                  key={item.step}
                  className={cn(
                    "p-3 shadow-none border",
                    item.done ? "border-green-200 bg-green-50" : "border-dashed"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <ClipboardPlus className="h-4 w-4 text-muted-foreground mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{item.value}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleCreate} disabled={!canCreate} className="w-full">
                {isSaving ? t("projects.aiCreate.creating") : t("projects.aiCreate.createCta")}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <LinkWithOverlay href="/app/projects/new">
                  {t("projects.aiCreate.openForm")}
                </LinkWithOverlay>
              </Button>
            </div>
          </div>
        </div>
      )}
    </SheetDialog>
  );
}
