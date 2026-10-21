/** OpenAI sends the student back here: check state, swap the code, verify the ID token, require plan usage. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/chatgpt-session";
import { FLOW_COOKIE, SESSION_COOKIE, decrypt, exchangeCode, hasPlanScope, siwcConfig, verifyIdToken } from "@/lib/siwc";
import { LIMITS, limitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const fail = (req: Request, reason: string) => {
  const res = NextResponse.redirect(new URL(`/plan?signin=${reason}`, req.url));
  res.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/chatgpt" });
  return res;
};

export async function GET(req: Request) {
  const limited = limitResponse(req, LIMITS.auth);
  if (limited) return limited;
  if (!siwcConfig().enabled) return fail(req, "off");
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return fail(req, q.get("error") === "access_denied" ? "denied" : "error");
  const jar = await cookies();
  let flow: { verifier: string; state: string; nonce: string; next: string };
  try { flow = JSON.parse(decrypt(jar.get(FLOW_COOKIE)?.value ?? "")); } catch { return fail(req, "expired"); }
  if (!q.get("code") || q.get("state") !== flow.state) return fail(req, "expired");
  try {
    const tokens = await exchangeCode(q.get("code")!, flow.verifier, siwcConfig(new URL(req.url).origin).redirectUri);
    if (!tokens.id_token) return fail(req, "error");
    const who = await verifyIdToken(tokens.id_token, flow.nonce);
    if (!hasPlanScope(tokens)) return fail(req, "noplan");
    const raw = await createSession(tokens, who);
    const res = NextResponse.redirect(new URL(flow.next, req.url));
    res.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/chatgpt" });
    res.cookies.set(SESSION_COOKIE, raw, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 });
    return res;
  } catch (e) {
    console.error("siwc callback", (e as Error).message);
    return fail(req, "error");
  }
}
