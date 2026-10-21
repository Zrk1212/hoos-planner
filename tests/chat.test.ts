import { describe, expect, it } from "vitest";
import { MAX_TOOL_ROUNDS, apiError, runChat, type ChatEvent } from "@/lib/chat";
import type { PlannerTool } from "@/lib/mcp/registry";

const sse = (events: object[]) => new Response(new ReadableStream({
  start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`)); c.close(); },
}), { status: 200, headers: { "Content-Type": "text/event-stream" } });

const call = (name: string, args: object, id = "c1") => ({ type: "response.output_item.done", item: { type: "function_call", call_id: id, name, arguments: JSON.stringify(args) } });
const text = (t: string) => [{ type: "response.output_text.delta", delta: t }, { type: "response.output_item.done", item: { type: "message", role: "assistant", content: [{ type: "output_text", text: t }] } }];

function tool(name: string, seen: unknown[]): PlannerTool {
  return { name, description: name, parameters: { type: "object" }, run: async (a) => { seen.push(a); return `ran ${name}`; } };
}

function base(responses: Response[], over: Partial<Parameters<typeof runChat>[0]> = {}) {
  const bodies: Record<string, unknown>[] = [];
  const events: ChatEvent[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return responses.shift()!; }) as unknown as typeof fetch;
  return { bodies, events, opts: { token: async () => "t", refresh: async () => "t2", model: "m", instructions: "i", history: [{ role: "user" as const, content: "hi" }], tools: [], emit: (e: ChatEvent) => events.push(e), fetchImpl, ...over } };
}

describe("chat loop", () => {
  it("streams a plain answer with plan-usage request rules", async () => {
    const { bodies, events, opts } = base([sse(text("Hello"))]);
    await runChat(opts);
    expect(events).toEqual([{ type: "text", delta: "Hello" }, { type: "done" }]);
    expect(bodies[0]).toMatchObject({ store: false, stream: true, model: "m", instructions: "i" });
    expect(bodies[0]).not.toHaveProperty("temperature");
    expect(bodies[0]).not.toHaveProperty("previous_response_id");
  });

  it("runs a tool call, sends its output back, then answers", async () => {
    const seen: unknown[] = [];
    const { bodies, events, opts } = base([sse([call("save_plan", { cart: [14431] })]), sse(text("Saved"))], {
      tools: [tool("save_plan", seen)], prepareArgs: (n, a) => (n === "save_plan" ? { ...a, code: "a".repeat(20) } : a),
    });
    await runChat(opts);
    expect(seen).toEqual([{ cart: [14431], code: "a".repeat(20) }]);
    const second = bodies[1].input as Array<Record<string, unknown>>;
    expect(second.some((i) => i.type === "function_call" && i.call_id === "c1")).toBe(true);
    expect(second.find((i) => i.type === "function_call_output")).toMatchObject({ call_id: "c1", output: "ran save_plan" });
    expect(events.filter((e) => e.type === "tool")).toHaveLength(2);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("stops offering tools after the round cap", async () => {
    const loops = Array.from({ length: MAX_TOOL_ROUNDS }, (_, i) => sse([call("get_term_info", {}, `c${i}`)]));
    const { bodies, opts } = base([...loops, sse(text("Done"))], { tools: [tool("get_term_info", [])] });
    await runChat(opts);
    expect(bodies).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(bodies.at(-1)).toMatchObject({ tool_choice: "none" });
  });

  it("refreshes once on 401", async () => {
    const tokens: string[] = [];
    const responses = [new Response("", { status: 401 }), sse(text("ok"))];
    const fetchImpl = (async (_u: string, init: RequestInit) => { tokens.push(String((init.headers as Record<string, string>).Authorization)); return responses.shift()!; }) as unknown as typeof fetch;
    const { opts } = base([], { fetchImpl });
    await runChat(opts);
    expect(tokens).toEqual(["Bearer t", "Bearer t2"]);
  });

  it("explains a plan limit", async () => {
    const { opts } = base([new Response('{"error":{"code":"usage_limit_reached"}}', { status: 429 })]);
    await expect(runChat(opts)).rejects.toMatchObject({ kind: "limit" });
    expect(apiError(403, "missing scope").kind).toBe("scope");
  });
});
