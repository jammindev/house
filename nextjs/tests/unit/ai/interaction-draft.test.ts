import { describe, expect, it } from "vitest";
import { __test } from "@/app/api/ai/interaction-draft/route";

const { normalizeType, normalizeDraft, normalizeStatus, normalizeOccurredAt } = __test;

describe("interaction draft type detection", () => {
  it("detects quote from explicit French keyword", () => {
    expect(normalizeType("devis")).toBe("quote");
    expect(normalizeType("quotation")).toBe("quote");
  });

  it("detects quote from prompt context", () => {
    const type = normalizeType(undefined, "j'ai reçu le devis de 12000 euros pour la véranda");
    expect(type).toBe("quote");
  });

  it("detects expense synonyms", () => {
    expect(normalizeType("facture")).toBe("expense");
    const type = normalizeType(undefined, "facture plomberie");
    expect(type).toBe("expense");
  });

  it("detects quote from English estimation context", () => {
    expect(normalizeType("estimate")).toBe("quote");
    const type = normalizeType(undefined, "Received an estimate for the veranda, 12000 EUR");
    expect(type).toBe("quote");
  });

  it("detects receipt/invoice as expense", () => {
    expect(normalizeType("receipt")).toBe("expense");
    const type = normalizeType(undefined, "paid invoice for roof repair");
    expect(type).toBe("expense");
  });

  it("falls back to note when nothing matches", () => {
    expect(normalizeType(undefined, "rappel aléatoire sans type")).toBe("note");
  });
});

describe("interaction draft normalization", () => {
  it("falls back to prompt for content and subject", () => {
    const draft = normalizeDraft(
      { type: "quote" },
      "devis de 12000 euros pour la véranda reçu aujourd'hui"
    );
    expect(draft.type).toBe("quote");
    expect(draft.subject).toContain("devis");
    expect(draft.content).toContain("12000");
  });

  it("normalizes status and occurredAt", () => {
    const occurred = normalizeOccurredAt("2024-01-01");
    expect(occurred?.startsWith("2024-01-01")).toBe(true);
    expect(normalizeStatus("pending")).toBe("pending");
    expect(normalizeStatus("unknown")).toBeUndefined();
    expect(normalizeOccurredAt("not-a-date")).toBeUndefined();
  });
});
