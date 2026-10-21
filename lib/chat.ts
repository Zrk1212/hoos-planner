/**
 * The in-site chat's agent loop over the OpenAI Responses API, billed to the student's ChatGPT plan through
 * Sign in with ChatGPT. Plan-usage requests must be streamed and unstored, and can't use system message items,
 * temperature or previous_response_id, so each turn resends the whole input and carries tool results inline.
 */
import type { PlannerTool } from "./mcp/registry";
import { API, SiwcError } from "./siwc";

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "start" | "done" }
  | { type: "done" }
  | { type: "error"; message: string; kind?: string };

export interface ChatMessage { role: "user" | "assistant"; content: string }
type InputItem = Record<string, unknown>;

export const MAX_TOOL_ROUNDS = 12;

/** Reads a Responses SSE stream: text deltas out, finished output items collected. */
async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") continue;
      try { yield JSON.parse(data); } catch { /* skip a malformed frame */ }
    }
  }
}

/** Turns an HTTP failure into something a student can act on. */
export function apiError(status: number, body: string): SiwcError {
  const b = body.toLowerCase();
  if (status === 401) return new SiwcError("reauth", "ChatGPT sign-in expired");
  if (status === 429 || /usage_limit|quota|rate_limit/.test(b)) return new SiwcError("limit", "You've reached your ChatGPT plan's limit for now. Try again later, or keep planning with the Claude connector.");
  if (status === 403 && /scope|permission/.test(b)) return new SiwcError("scope", "ChatGPT didn't grant plan usage. Sign in again and allow Hoos Planner to use your plan.");
  return new SiwcError("api", `ChatGPT returned an error (${status}). Try again in a moment.`);
}

export interface RunOpts {
  token: () => Promise<string>;
  /** called once on a 401 to get a refreshed token */
  refresh: () => Promise<string>;
  model: string;
  instructions: string;
  history: ChatMessage[];
  tools: PlannerTool[];
  /** lets the caller rewrite tool arguments (the chat pins save_plan to the page's plan code) */
  prepareArgs?: (name: string, args: Record<string, unknown>) => Record<string, unknown>;
  emit: (e: ChatEvent) => void;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function runChat(o: RunOpts): Promise<void> {
  const f = o.fetchImpl ?? fetch;
  const byName = new Map(o.tools.map((t) => [t.name, t]));
  const input: InputItem[] = o.history.map((m) => ({ role: m.role, content: m.content }));
  const tools = o.tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters, strict: false }));
  let token = await o.token();
  let retried = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await f(`${API}/responses`, {
      method: "POST", signal: o.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        model: o.model, instructions: o.instructions, input, tools,
        store: false, stream: true, include: ["reasoning.encrypted_content"],
        // the last round gets no tools, so the model has to answer in words
        ...(round === MAX_TOOL_ROUNDS ? { tool_choice: "none" } : {}),
      }),
    });
    if (res.status === 401 && !retried) { retried = true; token = await o.refresh(); round--; continue; }
    if (!res.ok || !res.body) throw apiError(res.status, await res.text().catch(() => ""));

    const output: InputItem[] = [];
    for await (const ev of sse(res.body)) {
      if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") o.emit({ type: "text", delta: ev.delta });
      else if (ev.type === "response.output_item.done" && ev.item) output.push(ev.item as InputItem);
      else if (ev.type === "response.failed" || ev.type === "error") {
        const err = (ev.response as { error?: { code?: string; message?: string } } | undefined)?.error ?? (ev as { error?: { code?: string; message?: string } }).error;
        throw apiError(/limit|quota/.test(err?.code ?? "") ? 429 : 500, `${err?.code ?? ""} ${err?.message ?? ""}`);
      }
    }

    const calls = output.filter((it) => it.type === "function_call");
    if (!calls.length) { o.emit({ type: "done" }); return; }
    // reasoning, messages and calls go back as they came (store:false: the server keeps nothing between rounds)
    input.push(...output);
    for (const c of calls) {
      const name = String(c.name);
      o.emit({ type: "tool", name, status: "start" });
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(String(c.arguments || "{}")); } catch { /* the tool reports invalid arguments */ }
      if (o.prepareArgs) args = o.prepareArgs(name, args);
      const tool = byName.get(name);
      const out = tool ? await tool.run(args).catch((e: Error) => `Tool error: ${e.message}`) : `Unknown tool ${name}.`;
      input.push({ type: "function_call_output", call_id: c.call_id, output: out.slice(0, 60_000) });
      o.emit({ type: "tool", name, status: "done" });
    }
  }
  o.emit({ type: "done" });
}

/** Picks a model the signed-in plan can use: CHATGPT_MODEL if listed, else the first listed model. */
export async function pickModel(token: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const r = await fetchImpl(`${API}/models`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw apiError(r.status, await r.text().catch(() => ""));
  const j = (await r.json()) as { data?: Array<{ id: string; visibility?: string }> };
  const listed = (j.data ?? []).filter((m) => m.visibility === "list").map((m) => m.id);
  const want = process.env.CHATGPT_MODEL;
  if (want && listed.includes(want)) return want;
  if (!listed.length) throw new SiwcError("api", "No ChatGPT models are available to this account.");
  return listed[0];
}
