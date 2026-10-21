import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";

// Fake db: `rows` is what maybeSingle() resolves to; `dbError` forces the error path.
const state: { row: Record<string, unknown> | null; dbError: { message: string } | null; lastSelect?: string; inserted?: Record<string, unknown>; updated?: Record<string, unknown> } = { row: null, dbError: null };
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    from: () => ({
      select: (cols: string) => { state.lastSelect = cols; return { eq: () => ({ maybeSingle: async () => ({ data: state.dbError ? null : state.row, error: state.dbError }) }) }; },
      update: (r: Record<string, unknown>) => {
        state.updated = r;
        const q = { eq: () => q, select: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) };
        return q;
      },
      insert: async (r: Record<string, unknown>) => { state.inserted = r; return { error: null }; },
    }),
  }),
}));
vi.mock("@/lib/catalog", () => ({
  DEFAULT_TERM: "1272",
  loadCatalog: async () => ({
    term: { code: "1272", name: "Spring 2027", start_date: "2027-01-20", end_date: "2027-05-04", q_a_start: null, q_a_end: null, q_b_start: null, q_b_end: null, synced_at: null },
    sections: [], ratings: {},
  }),
}));

import { buildInstructions, clipProfile, registerPlannerTools } from "@/lib/mcp/register";
import { PlanCode } from "@/lib/plan-schema";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
function fakeServer(): { server: McpServer; tools: Map<string, Handler> } {
  const tools = new Map<string, Handler>();
  const server = { registerTool: (name: string, _cfg: unknown, h: Handler) => { tools.set(name, h); } } as unknown as McpServer;
  return { server, tools };
}
const textOf = (r: { content: Array<{ text: string }> }) => r.content.map((c) => c.text).join("\n");

describe("load_plan term check", () => {
  let tools: Map<string, Handler>;
  beforeEach(() => { state.row = null; state.dbError = null; const f = fakeServer(); registerPlannerTools(f.server, "1272"); tools = f.tools; });

  it("selects the term column and refuses a plan saved for another term", async () => {
    state.row = { term: "1268", profile: null, cart: [{ class_nbr: 12345 }], notes: null, updated_at: "2026-10-01" };
    const out = textOf(await tools.get("load_plan")!({ code: "a".repeat(20) }));
    expect(state.lastSelect).toMatch(/\bterm\b/);
    expect(out).toMatch(/saved for SIS term 1268/);
    expect(out).toMatch(/serves term 1272/);
    expect(out).not.toMatch(/PROFILE_JSON/);
  });

  it("loads a plan for the matching term", async () => {
    state.row = { term: "1272", profile: null, cart: [{ class_nbr: 12345 }], notes: "hi", updated_at: "2026-10-01" };
    const out = textOf(await tools.get("load_plan")!({ code: "a".repeat(20) }));
    expect(out).toMatch(/^Plan a{20}/);
    expect(out).toMatch(/not in the current catalog: 12345/);
    expect(out).toMatch(/no profile saved/);
  });

  it("reports a database error instead of saying the plan does not exist", async () => {
    state.dbError = { message: "connection refused" };
    const out = textOf(await tools.get("load_plan")!({ code: "a".repeat(20) }));
    expect(out).toMatch(/Could not load plan .*connection refused/);
    expect(out).not.toMatch(/No plan with code/);
  });

  it("says when the code is unknown", async () => {
    const out = textOf(await tools.get("load_plan")!({ code: "b".repeat(20) }));
    expect(out).toMatch(/Nothing is saved under b{20} yet/);
  });
});

describe("save_plan with a code from the website", () => {
  beforeEach(() => { state.row = null; state.dbError = null; state.inserted = undefined; state.updated = undefined; });

  const saved = { code: "e".repeat(20), term: "1272", cart: [{ class_nbr: 14431 }, { class_nbr: 18012 }, { class_nbr: 14393, backup: true, replaces: 14431 }], updated_at: "2026-10-21" };

  it("leaves the saved cart alone when an update sends only notes", async () => {
    state.row = saved;
    const f = fakeServer(); registerPlannerTools(f.server, "1272");
    const out = textOf(await f.tools.get("save_plan")!({ code: "e".repeat(20), notes: "just notes" }));
    expect(state.updated).not.toHaveProperty("cart");
    expect(out).toMatch(/2 sections, 1 backup/);
  });

  it("keeps saved backups when an update sends only the cart", async () => {
    state.row = saved;
    const f = fakeServer(); registerPlannerTools(f.server, "1272");
    await f.tools.get("save_plan")!({ code: "e".repeat(20), cart: [14431, 12099] });
    expect(state.updated?.cart).toEqual([{ class_nbr: 14431 }, { class_nbr: 12099 }, { class_nbr: 14393, backup: true, replaces: 14431 }]);
  });

  it("keeps the saved main schedule when an update sends only backups", async () => {
    state.row = saved;
    const f = fakeServer(); registerPlannerTools(f.server, "1272");
    await f.tools.get("save_plan")!({ code: "e".repeat(20), backups: [{ class_nbr: 16799, replaces: 18012 }] });
    expect(state.updated?.cart).toEqual([{ class_nbr: 14431 }, { class_nbr: 18012 }, { class_nbr: 16799, backup: true, replaces: 18012 }]);
  });

  it("accepts a pasted code with spaces and capitals", () => {
    expect(PlanCode.parse("  " + "C".repeat(20) + " ")).toBe("c".repeat(20));
    expect(PlanCode.safeParse("c".repeat(19)).success).toBe(false);
  });

  it("creates the plan under that code on the first save", async () => {
    const f = fakeServer(); registerPlannerTools(f.server, "1272");
    const out = textOf(await f.tools.get("save_plan")!({ cart: [14431], code: "c".repeat(20) }));
    expect(state.inserted?.code).toBe("c".repeat(20));
    expect(out).toMatch(/^Saved plan c{20}/);
    expect(out).toMatch(/schedule\?plan=c{20}/);
  });

  it("updates without inserting when the plan exists", async () => {
    state.row = { code: "d".repeat(20) };
    const f = fakeServer(); registerPlannerTools(f.server, "1272");
    const out = textOf(await f.tools.get("save_plan")!({ cart: [14431], code: "d".repeat(20) }));
    expect(state.inserted).toBeUndefined();
    expect(out).toMatch(/^Saved plan d{20}/);
  });
});

describe("rate_course course normalization", () => {
  it("accepts DS1002, ds  1002 and DS 1002 as the same course", async () => {
    const f = fakeServer(); registerPlannerTools(f.server, "1272");
    for (const q of ["DS1002", "ds  1002", "DS 1002", " ds1002 "]) {
      expect(textOf(await f.tools.get("rate_course")!({ course: q }))).toMatch(/^No data for DS 1002\./);
    }
  });
});

describe("instructions composition", () => {
  it("claims 'never live SIS' only when live tools are absent", () => {
    expect(buildInstructions()).toMatch(/never live SIS, never NetBadge/);
    expect(buildInstructions({ live: false })).toMatch(/never live SIS/);
    const live = buildInstructions({ live: true });
    expect(live).not.toMatch(/never live SIS/);
    expect(live).toMatch(/live_\* tools/);
    expect(live).toMatch(/student presses Enroll/);
  });
});

describe("clipProfile", () => {
  it("clips free-text fields to the ProfileSchema caps", () => {
    const long = "x".repeat(500);
    const p = clipProfile({ courses: [{ course: "DS 1002", title: long, credits: 3, status: "completed", grade: "A+++++++++", term: long, source: long }], tests: [{ exam: long, score: "123456789" }], worldLanguagePlacement: false, notes: [long], parsedAt: long, sourceFormat: "unknown", program: long });
    expect(p.courses[0].title).toHaveLength(200);
    expect(p.courses[0].term).toHaveLength(200);
    expect(p.courses[0].grade).toHaveLength(8);
    expect(p.courses[0].source).toHaveLength(40);
    expect(p.tests[0].exam).toHaveLength(200);
    expect(p.tests[0].score).toHaveLength(8);
    expect(p.notes[0]).toHaveLength(200);
    expect(p.program).toHaveLength(200);
    expect(p.parsedAt).toHaveLength(40);
  });
});
