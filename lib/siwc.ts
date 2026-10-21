/**
 * Sign in with ChatGPT for the in-site chat (OAuth 2.0 code flow + PKCE, OpenID Connect), with ChatGPT plan
 * usage so the student's own plan pays for inference. Hosted apps need an OpenAI-issued client ID (partner
 * trial), so everything here is behind SIWC_ENABLED.
 * Docs: https://developers.openai.com/siwc/ (website, token-sharing-open-source/models-and-inference).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { siteOrigin } from "./plans";

export const ISSUER = "https://auth.openai.com";
export const AUTHORIZE_URL = `${ISSUER}/api/accounts/authorize`;
export const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
export const API = "https://api.openai.com/v1";
/** identity plus the plan-usage scopes; plan usage is a separate consent the user can decline */
export const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export const PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const SESSION_COOKIE = "hp_cg";
export const FLOW_COOKIE = "hp_cg_flow";

/** origin: the request's own origin, so localhost and previews call back to themselves (each must be registered) */
export function siwcConfig(origin = siteOrigin()) {
  const clientId = process.env.OPENAI_SIWC_CLIENT_ID ?? "";
  return {
    enabled: process.env.SIWC_ENABLED === "1" && !!clientId,
    clientId,
    clientSecret: process.env.OPENAI_SIWC_CLIENT_SECRET || undefined,
    redirectUri: `${origin}/api/auth/chatgpt/callback`,
  };
}

const b64url = (b: Buffer) => b.toString("base64url");
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** PKCE S256 pair. */
export function pkce() {
  const verifier = randomToken(32);
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export function authorizeUrl(o: { state: string; nonce: string; challenge: string; clientId: string; redirectUri: string }): string {
  const q = new URLSearchParams({
    client_id: o.clientId, response_type: "code", redirect_uri: o.redirectUri, scope: SCOPES,
    resource: API, state: o.state, nonce: o.nonce, code_challenge: o.challenge, code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${q}`;
}

export interface TokenSet { access_token: string; refresh_token?: string; id_token?: string; expires_in?: number; scope?: string }

async function tokenRequest(body: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<TokenSet> {
  const cfg = siwcConfig();
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const form = new URLSearchParams(body);
  if (cfg.clientSecret) headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString("base64")}`;
  else form.set("client_id", cfg.clientId);
  const r = await fetchImpl(TOKEN_URL, { method: "POST", headers, body: form });
  const j = (await r.json().catch(() => ({}))) as TokenSet & { error?: string; error_description?: string };
  if (!r.ok || !j.access_token) throw new SiwcError(j.error === "invalid_grant" ? "reauth" : "token", j.error_description || j.error || `token endpoint ${r.status}`);
  return j;
}

export const exchangeCode = (code: string, verifier: string, redirectUri: string, fetchImpl?: typeof fetch) =>
  tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri }, fetchImpl);
export const refreshTokens = (refresh: string, fetchImpl?: typeof fetch) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refresh }, fetchImpl);

export class SiwcError extends Error {
  constructor(public kind: "reauth" | "token" | "scope" | "id_token" | "limit" | "api", message: string) { super(message); }
}

/** The token response must grant plan usage; a valid ID token alone doesn't. */
export function hasPlanScope(t: TokenSet): boolean {
  return (t.scope ?? "").split(/\s+/).includes(PLAN_SCOPE);
}

export async function verifyIdToken(idToken: string, nonce: string): Promise<{ sub: string; email?: string }> {
  const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER, audience: siwcConfig().clientId });
  if (payload.nonce !== nonce) throw new SiwcError("id_token", "nonce mismatch");
  return { sub: String(payload.sub), email: typeof payload.email === "string" ? payload.email : undefined };
}

/* ---------- token encryption (AES-256-GCM, key from TOKEN_ENC_KEY, base64 32 bytes) ---------- */

function encKey(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENC_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64");
  return k;
}

export function encrypt(plain: string, key = encKey()): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map(b64url).join(".");
}

export function decrypt(sealed: string, key = encKey()): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
