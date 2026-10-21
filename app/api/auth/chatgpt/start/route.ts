/** Starts Sign in with ChatGPT: PKCE + state + nonce kept in a short-lived httpOnly cookie, then off to OpenAI. */
import { NextResponse } from "next/server";
import { FLOW_COOKIE, authorizeUrl, encrypt, pkce, randomToken, siwcConfig } from "@/lib/siwc";
import { LIMITS, limitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = limitResponse(req, LIMITS.auth);
  if (limited) return limited;
  const cfg = siwcConfig(new URL(req.url).origin);
  if (!cfg.enabled) return NextResponse.redirect(new URL("/plan?signin=off", req.url));
  const { verifier, challenge } = pkce();
  const state = randomToken(16), nonce = randomToken(16);
  // where to come back to: only same-site paths
  const back = new URL(req.url).searchParams.get("next") ?? "/plan";
  const next = /^\/[A-Za-z0-9/_?=&.-]*$/.test(back) && !back.startsWith("//") ? back : "/plan";
  const res = NextResponse.redirect(authorizeUrl({ state, nonce, challenge, clientId: cfg.clientId, redirectUri: cfg.redirectUri }));
  res.cookies.set(FLOW_COOKIE, encrypt(JSON.stringify({ verifier, state, nonce, next })), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/chatgpt", maxAge: 600,
  });
  return res;
}
