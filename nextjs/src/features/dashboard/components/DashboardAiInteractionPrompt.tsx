"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import AddDocumentsModal, { type StagedDocument } from "@documents/components/AddDocumentModal";
import SelectedFileItem from "@interactions/components/SelectedFileItem";
import type { LocalFile } from "@interactions/components/forms/common/DocumentsFields";
import type { InteractionStatus } from "@interactions/types";
import { storeDraftFiles } from "@interactions/utils/draftUploadsStore";

type DraftResponse = {
  subject?: string;
  content?: string;
  type?: string;
  status?: InteractionStatus;
  occurredAt?: string;
};

const STATUS_SET = new Set<InteractionStatus>(["pending", "in_progress", "done", "archived"]);

const TYPE_TO_PATH: Record<string, string> = {
  todo: "/app/interactions/new/todo",
  task: "/app/interactions/new/todo",
  quote: "/app/interactions/new/quote",
  expense: "/app/interactions/new/expense",
  call: "/app/interactions/new/call",
  visit: "/app/interactions/new/visit",
  note: "/app/interactions/new/note",
};

const clampText = (value?: string | null, maxLength = 800) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const buildRedirectUrl = (draft: DraftResponse, fallbackPrompt: string, draftId?: string | null) => {
  const params = new URLSearchParams();
  const subject = clampText(draft.subject ?? fallbackPrompt, 160);
  if (!subject) return null;

  const content = clampText(draft.content, 900);
  const status = draft.status && STATUS_SET.has(draft.status) ? draft.status : undefined;

  params.set("subject", subject);
  if (content) params.set("content", content);
  if (status) params.set("status", status);
  if (draft.occurredAt) params.set("occurredAt", draft.occurredAt);
  if (draftId) params.set("draftId", draftId);

  const normalizedType = (draft.type ?? "").toLowerCase();
  const basePath = TYPE_TO_PATH[normalizedType] ?? TYPE_TO_PATH.note;
  const queryString = params.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
};

export default function DashboardAiInteractionPrompt() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { selectedHouseholdId } = useGlobal();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);

  const handleDocumentsStaged = (staged: StagedDocument[]) => {
    if (!staged.length) return;
    setFiles((prev) => [
      ...prev,
      ...staged.map<LocalFile>((item) => ({
        file: item.file,
        customName: item.name || item.file.name,
        type: item.type,
        notes: item.notes,
      })),
    ]);
  };

  const handleFileNameChange = (index: number, value: string) => {
    setFiles((prev) => prev.map((item, idx) => (idx === index ? { ...item, customName: value } : item)));
  };

  const handleFileTypeChange = (index: number, nextType: LocalFile["type"]) => {
    setFiles((prev) => prev.map((item, idx) => (idx === index ? { ...item, type: nextType } : item)));
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length < 6) {
      setError(t("dashboard.aiDraft.promptTooShort"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/interaction-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: normalizedPrompt, locale }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message =
          payload?.error ||
          (response.status === 429
            ? t("dashboard.aiDraft.rateLimited")
            : t("dashboard.aiDraft.genericError"));
        throw new Error(message);
      }

      const draft: DraftResponse = payload?.draft ?? {};
      const draftId = files.length ? (crypto.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}`) : null;
      if (draftId && files.length) {
        storeDraftFiles(draftId, files);
      }

      const redirectUrl = buildRedirectUrl(draft, normalizedPrompt, draftId);
      if (!redirectUrl) {
        throw new Error(t("dashboard.aiDraft.noDraft"));
      }

      router.push(redirectUrl);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t("dashboard.aiDraft.genericError");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("dashboard.aiDraft.title")}
        </CardTitle>
        <CardDescription>{t("dashboard.aiDraft.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t("dashboard.aiDraft.placeholder")}
            rows={3}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{t("dashboard.aiDraft.attachLabel")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedHouseholdId}
                onClick={() => setDocumentsModalOpen(true)}
              >
                {t("dashboard.aiDraft.attachCta")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.aiDraft.attachHelper")}</p>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((item, index) => (
                  <SelectedFileItem
                    key={`${item.file.name}-${index}`}
                    index={index}
                    file={item.file}
                    type={item.type}
                    customName={item.customName}
                    fileTypeLabel={t("interactionsfileTypeLabel")}
                    onCustomNameChange={handleFileNameChange}
                    onFileTypeChange={handleFileTypeChange}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </ul>
            )}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t("dashboard.aiDraft.helper")}</p>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("dashboard.aiDraft.loading")}
                </>
              ) : (
                t("dashboard.aiDraft.cta")
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      <AddDocumentsModal
        open={documentsModalOpen}
        onOpenChange={setDocumentsModalOpen}
        householdId={selectedHouseholdId || ""}
        mode="staging"
        multiple
        onStagedChange={handleDocumentsStaged}
      />
    </Card>
  );
}
