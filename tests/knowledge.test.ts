import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KNOWLEDGE } from "@/lib/mcp/knowledge";

describe("knowledge module", () => {
  it("is in sync with knowledge.md (run: npx tsx scripts/build-knowledge.ts)", () => {
    expect(KNOWLEDGE).toBe(readFileSync("lib/mcp/knowledge.md", "utf8"));
  });
});
