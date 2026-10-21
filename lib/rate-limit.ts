/**
 * Sliding-window rate limiter keyed by client IP.
 * Best-effort: state lives in an in-memory Map per serverless instance, so the effective limit across a
 * fleet is higher than configured and resets on cold start. It blunts abuse; it is not a hard guarantee.
 * Use a Vercel Firewall rule for hard limits.
 */
export type Limit = { name: string; max: number; windowMs: number };

export const LIMITS = {
  plansPost: { name: "plans-post", max: 60, windowMs: 60_000 },
  // the live pages poll every 3s per open tab, so leave room for several tabs on one network
  plansGet: { name: "plans-get", max: 240, windowMs: 60_000 },
  // claude.ai connectors call from Anthropic's shared egress IPs, so one "IP" can be many students at once
  mcp: { name: "mcp", max: 1200, windowMs: 60_000 },
  catalog: { name: "catalog", max: 30, windowMs: 60_000 },
  sections: { name: "sections", max: 60, windowMs: 60_000 },
  auth: { name: "auth", max: 20, windowMs: 60_000 },
  chat: { name: "chat", max: 20, windowMs: 60_000 },
} as const satisfies Record<string, Limit>;

const hits = new Map<string, number[]>();
let lastSweep = 0;

// Vercel overwrites x-real-ip with the connecting client's address, so it can't be spoofed there; the first
// x-forwarded-for hop is only a fallback for other hosts.
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const first = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return first || "unknown";
}

export type RateResult = { ok: true } | { ok: false; retryAfter: number };

export function rateLimit(limit: Limit, ip: string, now = Date.now()): RateResult {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 10 * 60_000) hits.delete(k);
  }
  const key = `${limit.name}:${ip}`;
  const arr = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);
  if (arr.length >= limit.max) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((arr[0] + limit.windowMs - now) / 1000)) };
  }
  arr.push(now);
  hits.set(key, arr);
  return { ok: true };
}

/** Returns a 429 Response when over the limit, else null. */
export function limitResponse(req: Request, limit: Limit): Response | null {
  const r = rateLimit(limit, clientIp(req));
  if (r.ok) return null;
  return Response.json({ error: "rate limited" }, { status: 429, headers: { "Retry-After": String(r.retryAfter), "Cache-Control": "no-store" } });
}

/** Rejects a declared body larger than maxBytes (413), else null. */
export function bodyTooLarge(req: Request, maxBytes: number): Response | null {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > maxBytes) return Response.json({ error: "too large" }, { status: 413 });
  return null;
}

/**
 * Reads the body as text, stopping as soon as it passes maxBytes. Catches chunked uploads that send no
 * Content-Length, which bodyTooLarge can't see.
 */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<string | Response> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => {}); return Response.json({ error: "too large" }, { status: 413 }); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function _resetRateLimit() { hits.clear(); lastSweep = 0; }
