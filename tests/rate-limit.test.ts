import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS, _resetRateLimit, bodyTooLarge, clientIp, limitResponse, rateLimit, readBodyCapped } from "@/lib/rate-limit";

const L = { name: "t", max: 3, windowMs: 1000 };
beforeEach(() => _resetRateLimit());

describe("rateLimit", () => {
  it("allows up to max then blocks with retryAfter", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit(L, "1.1.1.1", 0).ok).toBe(true);
    const r = rateLimit(L, "1.1.1.1", 500);
    expect(r).toEqual({ ok: false, retryAfter: 1 });
  });
  it("slides: allows again after the window", () => {
    for (let i = 0; i < 3; i++) rateLimit(L, "a", 0);
    expect(rateLimit(L, "a", 1001).ok).toBe(true);
  });
  it("keys by ip and by limit name", () => {
    for (let i = 0; i < 3; i++) rateLimit(L, "a", 0);
    expect(rateLimit(L, "b", 0).ok).toBe(true);
    expect(rateLimit({ ...L, name: "other" }, "a", 0).ok).toBe(true);
  });
});

describe("helpers", () => {
  it("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "8.8.8.8", "x-forwarded-for": "6.6.6.6" } }))).toBe("8.8.8.8");
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
  it("limitResponse returns 429 with Retry-After", async () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "7.7.7.7" } });
    let res: Response | null = null;
    for (let i = 0; i <= LIMITS.catalog.max; i++) res = limitResponse(req, LIMITS.catalog);
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("bodyTooLarge checks content-length", () => {
    expect(bodyTooLarge(new Request("http://x", { method: "POST", headers: { "content-length": "300000" } }), 262144)?.status).toBe(413);
    expect(bodyTooLarge(new Request("http://x", { method: "POST", headers: { "content-length": "10" } }), 262144)).toBeNull();
  });

  it("caps a streamed body that sends no Content-Length", async () => {
    const big = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < 4; i++) c.enqueue(new Uint8Array(1024)); c.close(); } });
    const req = new Request("http://x", { method: "POST", body: big, duplex: "half" } as RequestInit);
    expect(req.headers.get("content-length")).toBeNull();
    const r = await readBodyCapped(req, 2048);
    expect(r instanceof Response && r.status).toBe(413);
    expect(await readBodyCapped(new Request("http://x", { method: "POST", body: "hi" }), 2048)).toBe("hi");
  });
});
