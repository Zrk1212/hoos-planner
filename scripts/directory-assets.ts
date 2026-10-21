// ChatGPT app-directory assets in public/directory/: the Rotunda logo (512 and 1024, navy on white, square, no border)
// and 706x800 screenshots of the demo plan's Schedule, Cart and Requirements pages.
// Needs the dev server (npm run dev -- --port 3077) and Google Chrome (driven over DevTools, no Playwright); usage: npx tsx scripts/directory-assets.ts [origin]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { MARK } from "../components/logo-paths";

const ORIGIN = process.argv[2] ?? "http://localhost:3077";
const PLAN = "fdf21c75837779d89dd6";
const PAGES = ["schedule", "cart", "requirements"];
const OUT = path.join(__dirname, "..", "public", "directory");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const NAVY = "#232D4B";

// Same strokes as app/icon.svg, minus the dark-mode swap and the orange oculus glow; centered on the glyph with a white margin
function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -2 76 76"><rect x="-6" y="-2" width="76" height="76" fill="#fff"/>`
    + `<g fill="none" stroke="${NAVY}" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="${MARK.heavy}" stroke-width="3"/><path d="${MARK.light}" stroke-width="1.6" stroke-opacity="0.65"/>`
    + `<path d="${MARK.cols}" stroke-width="2.4"/><circle cx="32" cy="38" r="1.3" stroke-width="1.3"/></g></svg>`;
}

async function logos() {
  for (const size of [512, 1024]) {
    const file = path.join(OUT, `logo-${size}.png`);
    await sharp(Buffer.from(logoSvg()), { density: (72 * size) / 76 }).resize(size, size).flatten({ background: "#fff" }).png().toFile(file);
    console.log(file);
  }
}

/** Minimal Chrome DevTools client over Node's built-in WebSocket (no Playwright dependency). */
async function devtools(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map<number, (r: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); pending.get(m.id)?.(m); pending.delete(m.id); };
  const send = (method: string, params: object = {}, sessionId?: string) => new Promise<Record<string, unknown>>((ok, fail) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result ?? {})));
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  return { send, close: () => ws.close() };
}

// Drops what reads as a dev session in a store listing: Next's dev-tools badge, the "Viewing a shared plan" line,
// the localhost "Your link" row and the New plan / Delete plan buttons. Resolves once fonts are loaded.
const TIDY = `(() => {
  document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
  for (const el of document.querySelectorAll("main *")) {
    const t = el.textContent.trim();
    if (el.tagName === "BUTTON" && (t === "New plan" || t === "Delete plan")) el.style.visibility = "hidden";
    else if (t.startsWith("Viewing a shared plan") && !el.querySelector("h1") && t.length < 120) el.remove();
    else if (t.startsWith("Your link") && !el.querySelector("h1") && t.length < 200 && el.querySelector("button")) el.remove();
  }
  return document.fonts.ready.then(() => true);
})()`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function screenshots() {
  const profile = mkdtempSync(path.join(tmpdir(), "hp-shots-"));
  const chrome = spawn(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    let port = "";
    for (let i = 0; i < 100 && !port; i++) { await sleep(100); try { port = readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch { /* not up yet */ } }
    if (!port) throw new Error("Chrome did not start");
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json() as { webSocketDebuggerUrl: string };
    const cdp = await devtools(webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
    const page = (method: string, params: object = {}) => cdp.send(method, params, sessionId);
    await page("Emulation.setDeviceMetricsOverride", { width: 706, height: 800, deviceScaleFactor: 1, mobile: false });
    await page("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }] });
    for (const name of PAGES) {
      await page("Page.navigate", { url: `${ORIGIN}/${name}?plan=${PLAN}` });
      // ready = the plan has replaced the skeleton; then tidy the page and let fonts and fades settle
      for (let i = 0; i < 60; i++) {
        await sleep(250);
        const { result } = await page("Runtime.evaluate", { expression: "document.readyState === 'complete' && !document.querySelector('.skeleton')", returnByValue: true }) as { result: { value: boolean } };
        if (result.value) break;
      }
      await page("Runtime.evaluate", { expression: TIDY, awaitPromise: true });
      await sleep(1200);
      const { data } = await page("Page.captureScreenshot", { format: "png" }) as { data: string };
      const file = path.join(OUT, `screenshot-${name}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(file);
    }
    cdp.close();
  } finally {
    const exited = new Promise((r) => chrome.once("exit", r));
    chrome.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true });
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await logos();
  await screenshots();
  for (const f of ["logo-512", "logo-1024", ...PAGES.map((p) => `screenshot-${p}`)]) {
    const m = await sharp(path.join(OUT, `${f}.png`)).metadata();
    console.log(`${f}: ${m.width}x${m.height}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
