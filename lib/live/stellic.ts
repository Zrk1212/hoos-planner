/**
 * Live Stellic reads through the user's own signed-in Chrome (SSO via NetBadge happens in the browser).
 * Host discovered 2026-10-20: https://login.stellic.virginia.edu/app/ (virginia.stellic.com redirects there).
 */
import { parseAudit } from "../audit-parser";
import type { Profile } from "../types";
import { LiveError, runPy } from "./runner";

export const STELLIC = "https://login.stellic.virginia.edu";

const PAGE_TEXT = `
import time
def stellic_page(path):
    tid, sid = open_window(${JSON.stringify(STELLIC)} + path)
    try:
        txt = ""
        u = current_url(sid)
        for _ in range(40):
            try:
                txt = page_text(sid) or ""
            except Exception:
                txt = ""
            u = current_url(sid)
            if "netbadge" in u or "shib" in u or "idp" in u:
                return {"url": u, "text": ""}
            if "loading content" not in txt and "setting things up" not in txt and len(txt) > 1500: break
            time.sleep(1.5)
        return {"url": u, "text": txt}
    finally:
        close(tid)
`;

function guard(url: string, text: string): void {
  if (!text || /netbadge|shibboleth|idp\.virginia/i.test(url)) throw new LiveError("Stellic is not signed in. Open https://login.stellic.virginia.edu in Chrome, sign in with NetBadge, then retry.");
}

/** Trim the app chrome (nav, sidebar) so only the audit/courses content remains. */
export function trimStellic(text: string): string {
  const markers = ["Transfer Credits", "Full Audit", "UNDERGRADUATES:", "Progress breakdown"];
  let start = -1;
  for (const m of markers) { const i = text.indexOf(m); if (i >= 0 && (start < 0 || i < start)) start = i; }
  const body = start >= 0 ? text.slice(start) : text;
  return body.replace(/Additional checks looks at all courses[^\n]*\n?/g, "").replace(/\n{2,}/g, "\n").trim();
}

export async function readCoursesPage(): Promise<{ text: string; profile: Profile }> {
  const { json } = await runPy(`${PAGE_TEXT}
r = stellic_page("/app/audit/transcript")
emit(r)`);
  const j = json as { url: string; text: string };
  guard(j.url, j.text);
  const text = trimStellic(j.text);
  return { text, profile: parseAudit(text) };
}

export async function readAuditPage(): Promise<{ text: string; profile: Profile }> {
  const { json } = await runPy(`${PAGE_TEXT}
r = stellic_page("/app/audit")
emit(r)`);
  const j = json as { url: string; text: string };
  guard(j.url, j.text);
  const text = trimStellic(j.text);
  return { text, profile: parseAudit(text) };
}

/** Stellic's own verdict per requirement block ("04 Remaining … The Engagements"), as a short summary. */
export function summarizeAuditBlocks(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d{2}) Remaining$/);
    if (m && lines[i + 1] === m[1] && lines[i + 2]) out.push(`${lines[i + 2]}: ${parseInt(m[1], 10)} remaining`);
    else if (lines[i] === "Taken" && /^[A-Z].{3,60}$/.test(lines[i + 1] ?? "") && !/^[A-Z]{2,4} \d{4}/.test(lines[i + 1]) && /fulfill|exactly|Constraint/.test(lines[i + 2] ?? "")) out.push(`${lines[i + 1]}: satisfied`);
  }
  return out.join("\n");
}
