import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import type { InteractionStatus } from "@interactions/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type DraftInteractionType = "note" | "todo" | "quote" | "expense" | "call" | "visit";

type RawToolDraft = {
  subject?: string;
  content?: string;
  type?: string;
  status?: string;
  occurred_at?: string;
};

type NormalizedDraft = {
  subject: string;
  content?: string;
  type: DraftInteractionType;
  status?: InteractionStatus;
  occurredAt?: string;
  draftId?: string | null;
};

const STATUS_OPTIONS = new Set<InteractionStatus>(["pending", "in_progress", "done", "archived"]);

const TYPE_MAP: Record<string, DraftInteractionType> = {
  todo: "todo",
  task: "todo",
  note: "note",
  message: "note",
  expense: "expense",
  invoice: "expense",
  receipt: "expense",
  facture: "expense",
  quote: "quote",
  devis: "quote",
  estimation: "quote",
  estimate: "quote",
  quotation: "quote",
  proposal: "quote",
  call: "call",
  phone_call: "call",
  phone: "call",
  appel: "call",
  visit: "visit",
  visite: "visit",
  inspection: "visit",
  rdv: "visit",
};

const TOOL_NAME = "propose_interaction";

const clampText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const normalizeType = (raw?: string, prompt?: string): DraftInteractionType => {
  const normalized = typeof raw === "string" ? raw.toLowerCase().replace(/\s+/g, "_") : "";
  if (normalized && TYPE_MAP[normalized]) return TYPE_MAP[normalized];

  const lowerPrompt = (prompt ?? "").toLowerCase();
  if (lowerPrompt.includes("devis") || lowerPrompt.includes("quote") || lowerPrompt.includes("estimate") || lowerPrompt.includes("estimation") || lowerPrompt.includes("quotation")) {
    return "quote";
  }
  if (lowerPrompt.includes("facture") || lowerPrompt.includes("invoice") || lowerPrompt.includes("reçu") || lowerPrompt.includes("receipt")) {
    return "expense";
  }
  if (lowerPrompt.includes("appel") || lowerPrompt.includes("call")) {
    return "call";
  }
  if (lowerPrompt.includes("visite") || lowerPrompt.includes("visit") || lowerPrompt.includes("inspection")) {
    return "visit";
  }
  if (lowerPrompt.includes("tâche") || lowerPrompt.includes("todo") || lowerPrompt.includes("à faire")) {
    return "todo";
  }

  return "note";
};

const normalizeStatus = (raw?: string): InteractionStatus | undefined => {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().trim() as InteractionStatus;
  return STATUS_OPTIONS.has(normalized) ? normalized : undefined;
};

const normalizeOccurredAt = (raw?: string) => {
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const normalizeDraft = (raw: RawToolDraft, fallbackPrompt: string): NormalizedDraft => {
  const subject = clampText(raw.subject, 160) ?? clampText(fallbackPrompt, 120) ?? "New interaction";
  const content = clampText(raw.content, 1500) ?? clampText(fallbackPrompt, 1500);
  const status = normalizeStatus(raw.status);
  const type = normalizeType(raw.type, fallbackPrompt);
  const occurredAt = normalizeOccurredAt(raw.occurred_at);

  return { subject, content, status, type, occurredAt };
};

const buildToolDefinition = () => ({
  type: "function",
  function: {
    name: TOOL_NAME,
    description: "Transform a short natural language request into a structured interaction draft.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Short title (3-10 words) summarizing the interaction.",
        },
        content: {
          type: "string",
          description: "A concise description with the key details from the request.",
        },
        type: {
          type: "string",
          description: "Interaction type that best fits the request.",
          enum: ["note", "todo", "quote", "expense", "call", "visit"],
        },
        status: {
          type: "string",
          description: "Optional status if the request implies progress.",
          enum: ["pending", "in_progress", "done", "archived"],
        },
        occurred_at: {
          type: "string",
          description: "Optional ISO date or datetime if mentioned by the user.",
        },
      },
      required: ["subject", "type"],
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
    }

    const supaSSR = await createSSRClient();
    const { data: userData } = await supaSSR.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, locale } = await req.json();
    const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const userLocale = typeof locale === "string" ? locale : "en";

    if (!trimmedPrompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You help households log interactions (notes, todos, quotes, expenses, calls, visits).",
            "Return concise fields that can pre-fill a form. Stay factual and avoid inventing details.",
            `Respond in ${userLocale === "fr" ? "French" : "English"} when writing subject and content.`,
          ].join(" "),
        },
        {
          role: "user",
          content: trimmedPrompt,
        },
      ],
      tools: [buildToolDefinition()],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
      temperature: 0.3,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      const detail = text ? `: ${text.slice(0, 300)}` : "";
      if (aiResponse.status === 429) {
        return NextResponse.json(
          { error: "The assistant is currently busy (rate limit). Please retry in a few seconds." },
          { status: 429 }
        );
      }
      const message = `Failed to generate draft (${aiResponse.status})${detail}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const completion = await aiResponse.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    const rawArgs = toolCall?.function?.arguments;

    let parsed: RawToolDraft = {};
    if (rawArgs && typeof rawArgs === "string") {
      try {
        parsed = JSON.parse(rawArgs);
      } catch (err) {
        console.warn("Failed to parse OpenAI tool arguments", err);
      }
    }

    const draft = normalizeDraft(parsed, trimmedPrompt);

    return NextResponse.json({ draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Exposed for unit tests
export const __test = {
  normalizeType,
  normalizeStatus,
  normalizeOccurredAt,
  normalizeDraft,
  TYPE_MAP,
};
