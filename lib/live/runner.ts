/**
 * Runs a Python snippet inside `browser-harness` (the local CDP daemon attached to the user's own Chrome)
 * and returns the JSON the snippet emits via emit(). Local-only: never used by the Vercel deployment.
 * The user signs in to NetBadge in Chrome themselves; we only use the session that is already there.
 *
 * Safety nets applied to every snippet:
 *  - a process-wide async mutex: live calls share one Chrome and one daemon, so they run one at a time
 *    (queued in arrival order), never interleaving window opens and clicks;
 *  - the snippet is executed inside `try/finally: close_all()`, so any window the helpers opened
 *    (harness.py tracks them in OPENED) is closed even when the snippet throws;
 *  - a `fail("...")` in the snippet surfaces as a LiveError with that exact message.
 * Known gap: when the daemon is SIGKILLed on timeout, nothing on our side can run the finally block, so a
 * killed snippet may leave its SIS/Stellic window open in Chrome; the user just closes it.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const HELPERS = resolve(__dirname, "harness.py");
const BIN = process.env.BROWSER_HARNESS_BIN ?? "browser-harness";

export class LiveError extends Error {}

let chain: Promise<unknown> = Promise.resolve();
/** Serialize live-browser work process-wide: `fn` starts only after every previously queued call settled. */
export function withLiveLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(() => fn());
  chain = run.then(() => undefined, () => undefined);
  return run;
}

/** Python string literal for `s` (JSON escapes are valid Python escapes; non-ASCII is \u-escaped to be safe). */
function pyStr(s: string): string {
  return JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function runPy(snippet: string, timeoutMs = 120_000): Promise<{ json: unknown; stdout: string }> {
  return withLiveLock(() => runPyUnlocked(snippet, timeoutMs));
}

function runPyUnlocked(snippet: string, timeoutMs: number): Promise<{ json: unknown; stdout: string }> {
  const script = [
    `exec(open(${pyStr(HELPERS)}).read())`,
    "try:",
    `    exec(compile(${pyStr(snippet)}, "<snippet>", "exec"))`,
    "except SystemExit:",
    "    raise",
    "except BaseException as _e:",
    `    emit({"__error": (str(_e) if isinstance(_e, LiveFailure) else "%s: %s" % (type(_e).__name__, _e))})`,
    "finally:",
    "    close_all()",
    "",
  ].join("\n");
  return new Promise((res, rej) => {
    const p = spawn(BIN, [], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => { p.kill("SIGKILL"); rej(new LiveError(`browser-harness timed out after ${timeoutMs / 1000}s (its window may still be open in Chrome; close it by hand)`)); }, timeoutMs);
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", (e) => { clearTimeout(t); rej(new LiveError(`browser-harness not available (${e.message}). Install it and enable remote debugging in Chrome (chrome://inspect/#remote-debugging).`)); });
    p.on("close", (code) => {
      clearTimeout(t);
      const m = out.match(/@@JSON@@([\s\S]*?)@@END@@/);
      if (code !== 0 && !m) {
        const msg = (err + "\n" + out).trim();
        if (/Allow remote debugging|remote debugging/i.test(msg)) return rej(new LiveError("Chrome is asking to allow remote debugging. Click Allow in Chrome (or enable it at chrome://inspect/#remote-debugging) and retry."));
        return rej(new LiveError(`browser-harness failed: ${msg.slice(-800)}`));
      }
      let json: unknown = null;
      try { json = m ? JSON.parse(m[1]) : null; }
      catch (e) { return rej(new LiveError(`bad JSON from harness: ${(e as Error).message}`)); }
      const failure = (json as { __error?: string } | null)?.__error;
      if (failure) return rej(new LiveError(failure));
      res({ json, stdout: out });
    });
    p.stdin.end(script);
  });
}
