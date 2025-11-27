import { describe, expect, it } from "vitest";
import { parseInteractionDraftParams } from "@interactions/utils/prefill";

describe("parseInteractionDraftParams", () => {
  it("parses known fields and keeps draftId", () => {
    const params = new URLSearchParams({
      subject: "Sujet",
      content: "Contenu",
      status: "pending",
      occurredAt: "2024-02-01T10:00",
      draftId: "draft-123",
    });

    const parsed = parseInteractionDraftParams(params);
    expect(parsed.subject).toBe("Sujet");
    expect(parsed.content).toBe("Contenu");
    expect(parsed.status).toBe("pending");
    expect(parsed.occurredAt?.startsWith("2024-02-01T10:00")).toBe(true);
    expect(parsed.draftId).toBe("draft-123");
  });

  it("ignores invalid status", () => {
    const params = new URLSearchParams({ status: "invalid" });
    expect(parseInteractionDraftParams(params).status).toBeUndefined();
  });
});
