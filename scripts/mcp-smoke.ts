/**
 * Smoke-test the remote MCP endpoint: list tools, run a search, check conflicts.
 *   npx tsx scripts/mcp-smoke.ts http://localhost:3077/api/mcp
 *   npx tsx scripts/mcp-smoke.ts stdio        # launches scripts/mcp-stdio.ts from / to prove cwd independence
 *   npx tsx scripts/mcp-smoke.ts live         # stdio + the live READ tools (needs Chrome signed in to SIS/Stellic)
 * Live mode never sets LIVE_WRITES: the cart-writing tools must not even be registered during a smoke run.
 * The non-live run deletes the shared_plans row it creates (service-role client; skipped when .env.local is absent).
 */
import "./_env";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { resolve } from "node:path";
import { adminClient } from "../lib/supabase/admin";

async function main() {
  const target = process.argv[2] ?? "http://localhost:3077/api/mcp";
  const client = new Client({ name: "smoke", version: "0.0.1" });
  if (target === "stdio" || target === "live") {
    const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"));
    delete env.LIVE_WRITES;
    if (target === "live") env.LIVE_BROWSER = "1";
    await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", resolve(__dirname, "mcp-stdio.ts")], cwd: "/", env }));
  } else {
    await client.connect(new StreamableHTTPClientTransport(new URL(target)));
  }
  if (target === "live") {
    const names = (await client.listTools()).tools.map((t) => t.name);
    console.log("tools:", names.join(", "));
    for (const w of ["live_add_to_cart", "live_delete_from_cart"]) if (names.includes(w)) throw new Error(`${w} is registered during a smoke run (LIVE_WRITES must stay unset)`);
    const live = async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({ name, arguments: args });
      const t = (r.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("\n");
      console.log(`\n== ${name}\n${t.slice(0, 1800)}`);
      if (/^⚠/.test(t)) throw new Error(`${name} failed: ${t.slice(0, 200)}`);
    };
    await live("live_read_profile", {});
    await live("live_read_cart", { include_planner: true, include_dates: true });
    await live("live_read_stellic", { page: "courses" });
    await live("live_validate_cart", {});
    await client.close();
    return;
  }
  const rules = await client.callTool({ name: "get_planning_rules", arguments: {} });
  const rulesText = (rules.content as Array<{ text?: string }>)[0]?.text ?? "";
  if (!/Engagements/.test(rulesText)) throw new Error("get_planning_rules did not return the knowledge base");
  console.log(`get_planning_rules: ${rulesText.length} chars`);
  const tools = await client.listTools();
  console.log("tools:", tools.tools.map((t) => t.name).join(", "));
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    const t = (r.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? "").join("\n");
    console.log(`\n== ${name}\n${t.slice(0, 1200)}`);
    return t;
  };
  await call("get_term_info", {});
  await call("search_sections", { attrs: ["AIP"], earliest_start: "11:00", max_difficulty: 2, college_only: true, cart: [18012, 14401, 14402, 14431, 20843, 13525], avoid_conflicts: true, limit: 5 });
  await call("check_conflicts", { class_nbrs: [18012, 14401, 14402, 14431, 20843, 13525, 13965] });
  await call("rate_course", { course: "DS 1002" });
  const audit = `Program: Arts & Sciences Undeclared — Engagements Pathway
EGMT 1510 Engaging Aesthetics 2 A- Fall 2026 COMPLETED
EGMT 1520 Empirical Engagement 2 Fall 2026 CURRENTLY TAKING
ENWR 1510 Writing and Critical Inquiry 3 Fall 2026 CURRENTLY TAKING
COMM 1800 Foundations of Commerce 3 Fall 2026 CURRENTLY TAKING
ECON 2010 Principles of Microeconomics 3 Fall 2026 CURRENTLY TAKING
MATH 1310 Calculus I 4 TE TRANSFERRED
BIOL 2200 Organismal Biology 4 TE TRANSFERRED
AP Calculus AB (5)
World Language: satisfied by placement (SPAN 3010P)`;
  const parsed = await call("parse_audit", { text: audit });
  const profile = JSON.parse(parsed.split("PROFILE_JSON:\n")[1]);
  const cart = [18012, 14401, 14402, 14431, 20843, 13525, 13965];
  await call("requirement_status", { profile, cart });
  const saved = await call("save_plan", { profile, cart, notes: "smoke test" });
  const code = saved.match(/plan (?:code )?([a-f0-9]{20})/)?.[1];
  if (!code) throw new Error("no plan code returned");
  try {
    await call("load_plan", { code });
  } finally {
    await client.close();
    // tidy up the row this run created (needs the service-role key from .env.local)
    try {
      const { error } = await adminClient().from("shared_plans").delete().eq("code", code);
      console.log(error ? `cleanup failed for ${code}: ${error.message}` : `cleanup: deleted smoke plan ${code}`);
    } catch (e) {
      console.log(`cleanup skipped for ${code}: ${(e as Error).message}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
