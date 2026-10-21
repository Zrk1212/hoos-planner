/**
 * Exercises lib/live/runner.ts against tests/fixtures/fake-harness.sh (a stub that never touches Chrome):
 * the JSON channel, fail() → LiveError, the finally: close_all() safety net, and the process-wide mutex.
 */
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

process.env.BROWSER_HARNESS_BIN = resolve("tests/fixtures/fake-harness.sh");
const { LiveError, runPy, withLiveLock } = await import("@/lib/live/runner");

describe("runPy with the fake harness", () => {
  it("returns the JSON the snippet emits", async () => {
    const { json } = await runPy('emit({"a": 1, "s": "caf\\u00e9 →"})');
    expect(json).toEqual({ a: 1, s: "café →" });
  });

  it("turns fail('...') into a LiveError with that exact message", async () => {
    await expect(runPy('fail("Not in the SIS cart: 14401. Nothing was changed.")')).rejects.toThrow(LiveError);
    await expect(runPy('fail("boom")')).rejects.toThrow(/^boom$/);
  });

  it("surfaces other exceptions with their type", async () => {
    await expect(runPy("1/0")).rejects.toThrow(/ZeroDivisionError: division by zero/);
  });

  it("closes every tracked window in finally, even after the snippet emitted", async () => {
    const { stdout } = await runPy('OPENED.append("tid-1"); OPENED.append("tid-2"); emit({"ok": True})');
    expect(stdout).toContain("@@CLOSED tid-1@@");
    expect(stdout).toContain("@@CLOSED tid-2@@");
  });

  it("serializes concurrent calls (second starts after the first ends, in arrival order)", async () => {
    const snippet = (tag: string) => `import time\nt0 = time.time(); time.sleep(0.3); emit({"tag": ${JSON.stringify(tag)}, "start": t0, "end": time.time()})`;
    const order: string[] = [];
    const [a, b] = await Promise.all([
      runPy(snippet("a")).then((r) => { order.push("a"); return r.json as { start: number; end: number }; }),
      runPy(snippet("b")).then((r) => { order.push("b"); return r.json as { start: number; end: number }; }),
    ]);
    expect(order).toEqual(["a", "b"]);
    expect(b.start).toBeGreaterThanOrEqual(a.end);
  });

  it("keeps the lock usable after a rejected call", async () => {
    await expect(withLiveLock(async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(withLiveLock(async () => 42)).resolves.toBe(42);
  });
});
