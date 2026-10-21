/**
 * In-site chat: streams the planner conversation as server-sent events, running on the student's ChatGPT plan.
 * The browser sends only the visible transcript and its plan code; tokens and tool calls stay on the server.
 */
import { cookies } from "next/headers";
import { z } from "zod";
import { accessToken, loadSession, rememberModel } from "@/lib/chatgpt-session";
import { pickModel, runChat, type ChatEvent } from "@/lib/chat";
import { plannerTools } from "@/lib/mcp/registry";
import { buildInstructions } from "@/lib/mcp/register";
import { PlanCode } from "@/lib/plan-schema";
import { LIMITS, bodyTooLarge, limitResponse, readBodyCapped } from "@/lib/rate-limit";
import { SESSION_COOKIE, SiwcError, siwcConfig } from "@/lib/siwc";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  planCode: PlanCode,
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12_000) })).min(1).max(40),
});

const chatInstructions = (code: string) => `${buildInstructions()}

You are running inside the Hoos Planner website, next to the student's live Schedule, Cart and Requirements panels. Their plan code is ${code}; every save_plan uses it (it's filled in for you), so after saving just say the panels beside the chat are updated. You only see the visible chat text from earlier turns: call load_plan("${code}") when you need the saved profile, cart or backups. The chat shows plain text: write short sentences and "- " bullet lists, use **bold** sparingly, and never use tables or headings.`;

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!siwcConfig().enabled) return json(404, "ChatGPT sign-in is not available yet.");
  const limited = limitResponse(req, LIMITS.chat) ?? bodyTooLarge(req, 300_000);
  if (limited) return limited;
  const session = await loadSession((await cookies()).get(SESSION_COOKIE)?.value).catch(() => null);
  if (!session) return json(401, "Sign in with ChatGPT to chat.");
  const raw = await readBodyCapped(req, 300_000);
  if (raw instanceof Response) return raw;
  let parsed;
  try { parsed = Body.safeParse(JSON.parse(raw)); } catch { return json(400, "invalid json"); }
  if (!parsed.success) return json(400, "invalid chat");
  const { planCode, messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return json(400, "last message must be the student's");

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const emit = (e: ChatEvent) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        let model = session.model;
        if (!model) { model = await pickModel(await accessToken(session)); await rememberModel(session, model); }
        await runChat({
          token: () => accessToken(session), refresh: () => accessToken(session, { force: true }),
          model, instructions: chatInstructions(planCode), history: messages, tools: plannerTools(),
          // the page is already watching this code: pin every save to it
          prepareArgs: (name, args) => (name === "save_plan" || name === "load_plan" ? { ...args, code: planCode } : args),
          emit, signal: req.signal,
        });
      } catch (e) {
        const err = e instanceof SiwcError ? e : null;
        if (!req.signal.aborted) emit({ type: "error", kind: err?.kind, message: err?.kind === "reauth" ? "Your ChatGPT sign-in expired. Sign in again to keep going." : err?.message ?? "Something went wrong. Try again." });
        if (!err) console.error("chat", (e as Error).message);
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
