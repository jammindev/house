import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createSSRClient } from "@/lib/supabase/server";
import type { ProjectIntakeDraft, ProjectIntakeRequest, ProjectIntakeStep } from "@projects/features/ai-create/types";
import { PROJECT_INTAKE_LABELS, PROJECT_INTAKE_ORDER, PROJECT_INTAKE_QUESTIONS } from "@projects/features/ai-create/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const isAIConfigured = Boolean(
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here"
);

function redactPII(text: string): string {
  const emailRedacted = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]");
  const phoneRedacted = emailRedacted.replace(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, "[PHONE_REDACTED]");
  return phoneRedacted;
}

function formatDraft(draft: ProjectIntakeDraft, locale: "en" | "fr"): string {
  const label = (step: ProjectIntakeStep) => PROJECT_INTAKE_LABELS[step]?.[locale] ?? step;
  const formatDate = (value: string | null) => value || (locale === "fr" ? "Non défini" : "Not set");

  return [
    `${label("title")}: ${draft.title || (locale === "fr" ? "Non défini" : "Not set")}`,
    `${label("type")}: ${draft.type}`,
    `${label("startDate")}: ${formatDate(draft.startDate)}`,
    `${label("dueDate")}: ${formatDate(draft.dueDate)}`,
    `${label("plannedBudget")}: ${draft.plannedBudget != null ? `${draft.plannedBudget}€` : locale === "fr" ? "Non défini" : "Not set"}`,
    `${label("tags")}: ${draft.tags.length ? draft.tags.join(", ") : locale === "fr" ? "Aucun" : "None"}`,
    `${label("description")}: ${draft.description || (locale === "fr" ? "Aucune description" : "No description")}`,
  ].join("\n");
}

function isStepFilled(draft: ProjectIntakeDraft, step: ProjectIntakeStep): boolean {
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

function fallbackMessage(locale: "en" | "fr", nextStep: ProjectIntakeStep | null): string {
  if (nextStep) {
    const question = PROJECT_INTAKE_QUESTIONS[nextStep]?.[locale];
    return locale === "fr"
      ? `Compris. ${question || "Donne-moi la prochaine information quand tu es prêt."}`
      : `Got it. ${question || "Share the next detail when you can."}`;
  }

  return locale === "fr"
    ? "Parfait, je peux créer le projet avec ces infos. Confirme ou ajoute un dernier détail."
    : "Great, I can create the project with these details. Confirm or share a last tweak.";
}

export async function POST(request: NextRequest) {
  try {
    const body: ProjectIntakeRequest = await request.json();
    const locale: "en" | "fr" = body.locale?.startsWith("fr") ? "fr" : "en";

    if (!body.householdId) {
      return Response.json({ error: "householdId is required" }, { status: 400 });
    }

    if (!body.draft) {
      return Response.json({ error: "draft is required" }, { status: 400 });
    }

    const draft: ProjectIntakeDraft = {
      title: body.draft.title || "",
      description: body.draft.description || "",
      type: body.draft.type || "other",
      status: body.draft.status || "draft",
      priority: body.draft.priority ?? 3,
      startDate: body.draft.startDate ?? null,
      dueDate: body.draft.dueDate ?? null,
      plannedBudget: typeof body.draft.plannedBudget === "number" ? body.draft.plannedBudget : null,
      tags: Array.isArray(body.draft.tags) ? body.draft.tags : [],
    };

    const supabase = await createSSRClient();
    const { data: authData, error: userError } = await supabase.auth.getUser();
    if (userError || !authData?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("household_id", body.householdId)
      .eq("user_id", authData.user.id)
      .single();

    if (!membership) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: household } = await supabase
      .from("households")
      .select("name, ai_prompt_context")
      .eq("id", body.householdId)
      .single();

    const nextStep = body.nextStep ?? null;
    const latestAnswer = body.latestAnswer ? redactPII(body.latestAnswer) : null;
    const draftSummary = formatDraft(draft, locale);
    const missingSteps = PROJECT_INTAKE_ORDER.filter((step) => !isStepFilled(draft, step));

    const fallback = fallbackMessage(locale, nextStep);

    if (!isAIConfigured) {
      return Response.json({
        message: fallback,
        fallbackUsed: true,
        error: "AI not configured",
      });
    }

    const systemPrompt = locale === "fr"
      ? `Tu es l'assistant House. Tu aides à créer un projet via un échange naturel, question par question.
- Réponds en français avec un ton chaleureux et concis.
- Demande une seule info à la fois, pas de tableaux ni de blocs de code.
- Reste sous 80 mots, privilégie 1 à 3 phrases.
- Si le contexte du foyer est fourni, garde-le en tête: ${household?.ai_prompt_context ? redactPII(household.ai_prompt_context) : "aucun contexte"}`
      : `You are House, a friendly assistant that creates projects step by step.
- Respond in English with a warm, concise tone.
- Ask for one detail at a time, no tables or code blocks.
- Keep replies under 80 words, ideally 1-3 sentences.
- If household context exists, keep it in mind: ${household?.ai_prompt_context ? redactPII(household.ai_prompt_context) : "no extra context"}`;

    const userMessage = [
      `Household: ${household?.name ?? "current household"}`,
      `Latest answer (${body.step ? PROJECT_INTAKE_LABELS[body.step]?.[locale] ?? body.step : "start"}): ${latestAnswer ?? (locale === "fr" ? "Pas encore de réponse" : "No answer yet")}`,
      `Next step: ${nextStep ? PROJECT_INTAKE_LABELS[nextStep]?.[locale] ?? nextStep : locale === "fr" ? "finalisation" : "final summary"}`,
      `Current draft:\n${redactPII(draftSummary)}`,
      `Missing after this step: ${missingSteps.map((step) => PROJECT_INTAKE_LABELS[step]?.[locale] ?? step).join(", ") || (locale === "fr" ? "aucun" : "none")}`,
      "",
      "Guidance:",
      locale === "fr"
        ? [
          "1) Accuse réception de la dernière info de façon naturelle.",
          `2) Pose la question suivante: ${nextStep ? PROJECT_INTAKE_QUESTIONS[nextStep]?.[locale] ?? "" : "propose de finaliser et propose d'ajouter un détail si besoin."}`,
          "3) Reste bref, sans listes sauf si vraiment utile.",
        ].join("\n")
        : [
          "1) Acknowledge the latest detail naturally.",
          `2) Ask the next question: ${nextStep ? PROJECT_INTAKE_QUESTIONS[nextStep]?.[locale] ?? "" : "offer to finalize and invite any last tweak."}`,
          "3) Keep it brief, avoid lists unless essential.",
        ].join("\n"),
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    const message = completion.choices[0]?.message?.content?.trim() || fallback;

    return Response.json({
      message,
      fallbackUsed: message === fallback,
    });
  } catch (error) {
    console.error("Project AI intake error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
