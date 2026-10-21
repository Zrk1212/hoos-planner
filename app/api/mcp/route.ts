/**
 * Remote MCP endpoint (Streamable HTTP, stateless). Add it to claude.ai (Settings → Connectors → Add custom
 * connector) or Claude Code (`claude mcp add --transport http hoos-planner https://<host>/api/mcp`).
 * Read-only catalog tools plus plan codes; no auth needed, no credentials stored.
 */
import { createMcpHandler } from "mcp-handler";
import { LIMITS, bodyTooLarge, limitResponse, readBodyCapped } from "@/lib/rate-limit";
import { INSTRUCTIONS, SERVER_INFO, registerPlannerTools } from "@/lib/mcp/register";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const handler = createMcpHandler((server) => { registerPlannerTools(server); }, {
  serverInfo: SERVER_INFO,
  instructions: INSTRUCTIONS,
});

const MAX_BODY = 256 * 1024;

// Per-IP rate limit (best-effort per instance) and a 256 KB body cap in front of mcp-handler, which sets none.
// The body is read through the cap and re-wrapped, so chunked requests without Content-Length are bounded too.
async function guarded(req: Request) {
  const early = limitResponse(req, LIMITS.mcp) ?? bodyTooLarge(req, MAX_BODY);
  if (early) return early;
  if (req.method !== "POST") return handler(req);
  const body = await readBodyCapped(req, MAX_BODY);
  if (body instanceof Response) return body;
  // one JSON-RPC message per request: batches (dropped from the current MCP spec) would let one request
  // carry thousands of tool calls past the per-request rate limit
  if (/^\s*\[/.test(body)) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batch requests are not supported; send one message per request." } }, { status: 400 });
  return handler(new Request(req.url, { method: req.method, headers: req.headers, body }));
}

export { guarded as GET, guarded as POST, guarded as DELETE };
