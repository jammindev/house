import { describe, expect, it } from "vitest";
import { consumeDraftFiles, storeDraftFiles } from "@interactions/utils/draftUploadsStore";
import type { LocalFile } from "@interactions/components/forms/common/DocumentsFields";

const mockFile = (name: string): File =>
  new File(["content"], name, { type: "text/plain" });

describe("draftUploadsStore", () => {
  it("stores and consumes files by id", () => {
    const files: LocalFile[] = [
      { file: mockFile("a.txt"), customName: "A", type: "document" },
      { file: mockFile("b.txt"), customName: "B", type: "photo" },
    ];

    storeDraftFiles("draft-1", files);
    const consumed = consumeDraftFiles("draft-1");
    expect(consumed).toHaveLength(2);
    expect(consumed[0]?.customName).toBe("A");

    // Second consume should be empty (one-shot semantics)
    expect(consumeDraftFiles("draft-1")).toHaveLength(0);
  });

  it("ignores empty stores", () => {
    storeDraftFiles("draft-empty", []);
    expect(consumeDraftFiles("draft-empty")).toHaveLength(0);
  });
});
