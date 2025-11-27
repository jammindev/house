import { toLocalDateTimeInput } from "./datetime";
import type { InteractionStatus } from "@interactions/types";

export type InteractionDraftDefaults = {
  subject?: string;
  content?: string;
  status?: InteractionStatus;
  occurredAt?: string;
  draftId?: string;
};

const STATUS_SET = new Set<InteractionStatus>(["pending", "in_progress", "done", "archived"]);

const clampText = (value: string | null, maxLength: number) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

export const parseInteractionDraftParams = (searchParams?: URLSearchParams | null): InteractionDraftDefaults => {
  if (!searchParams) return {};

  const statusParam = searchParams.get("status");
  const subjectParam = searchParams.get("subject");
  const contentParam = searchParams.get("content");
  const occurredAtParam = searchParams.get("occurredAt") ?? searchParams.get("occurred_at");
  const draftId = searchParams.get("draftId") ?? undefined;

  const status = statusParam && STATUS_SET.has(statusParam as InteractionStatus)
    ? (statusParam as InteractionStatus)
    : undefined;

  const occurredAt = occurredAtParam ? toLocalDateTimeInput(occurredAtParam) : "";

  return {
    status,
    subject: clampText(subjectParam, 160),
    content: clampText(contentParam, 1200),
    occurredAt: occurredAt || undefined,
    draftId,
  };
};
