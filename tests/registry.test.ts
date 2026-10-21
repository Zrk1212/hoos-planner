import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog", () => ({
  DEFAULT_TERM: "1272",
  loadCatalog: async () => ({ term: { code: "1272", name: "Spring 2027" }, sections: [], ratings: {} }),
}));

import { plannerTools } from "@/lib/mcp/registry";

describe("planner tools for the web chat", () => {
  const tools = plannerTools("1272");
  it("exposes every MCP tool with an object JSON schema", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["check_conflicts", "get_planning_rules", "get_term_info", "load_plan", "parse_audit", "rate_course", "requirement_status", "save_plan", "search_sections"]);
    for (const t of tools) expect(t.parameters.type).toBe("object");
  });
  it("validates arguments before running a handler", async () => {
    const rate = tools.find((t) => t.name === "rate_course")!;
    expect(await rate.run({})).toMatch(/Invalid arguments for rate_course/);
    expect(await rate.run({ course: "ds1002" })).toMatch(/^No data for DS 1002/);
  });
});
