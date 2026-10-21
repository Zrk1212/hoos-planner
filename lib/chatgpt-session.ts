/**
 * Server-side Sign in with ChatGPT sessions (table chatgpt_sessions). The cookie holds a random token; rows are
 * keyed by its SHA-256 and store the OpenAI tokens encrypted. Access tokens last about an hour and refresh tokens
 * rotate on use, so refreshes are single-flight per instance and compare-and-swap across instances.
 */
import { decrypt, encrypt, randomToken, refreshTokens, sha256, SiwcError, type TokenSet } from "./siwc";

const IDLE_MS = 30 * 24 * 3600_000; // matches the refresh token's sliding window
const SKEW_MS = 60_000;

export interface SessionRow {
  id_hash: string; sub: string; email: string | null; enc_access: string; enc_refresh: string | null;
  access_expires_at: string; model: string | null; last_used_at: string;
}

async function db() {
  const { adminClient } = await import("./supabase/admin");
  return adminClient().from("chatgpt_sessions");
}

const expiresAt = (t: TokenSet) => new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();

export async function createSession(t: TokenSet, who: { sub: string; email?: string }): Promise<string> {
  const raw = randomToken(32);
  const { error } = await (await db()).insert({
    id_hash: sha256(raw), sub: who.sub, email: who.email ?? null,
    enc_access: encrypt(t.access_token), enc_refresh: t.refresh_token ? encrypt(t.refresh_token) : null,
    access_expires_at: expiresAt(t),
  });
  if (error) throw new Error(error.message);
  return raw;
}

export async function loadSession(raw: string | undefined): Promise<SessionRow | null> {
  if (!raw || raw.length > 100) return null;
  const { data } = await (await db()).select("*").eq("id_hash", sha256(raw)).maybeSingle();
  const row = data as SessionRow | null;
  if (!row) return null;
  if (Date.now() - Date.parse(row.last_used_at) > IDLE_MS) { await deleteSession(raw); return null; }
  return row;
}

export async function deleteSession(raw: string | undefined) {
  if (raw) await (await db()).delete().eq("id_hash", sha256(raw));
}

export async function rememberModel(row: SessionRow, model: string) {
  await (await db()).update({ model }).eq("id_hash", row.id_hash);
}

const inflight = new Map<string, Promise<string>>();

/** A usable access token for the session, refreshing (once, even under concurrent requests) when needed. */
export async function accessToken(row: SessionRow, opts: { force?: boolean; fetchImpl?: typeof fetch } = {}): Promise<string> {
  if (!opts.force && Date.parse(row.access_expires_at) - SKEW_MS > Date.now()) {
    void touch(row);
    return decrypt(row.enc_access);
  }
  const running = inflight.get(row.id_hash);
  if (running) return running;
  const p = (async () => {
    if (!row.enc_refresh) throw new SiwcError("reauth", "no refresh token");
    const t = await refreshTokens(decrypt(row.enc_refresh), opts.fetchImpl);
    const patch = { enc_access: encrypt(t.access_token), enc_refresh: t.refresh_token ? encrypt(t.refresh_token) : row.enc_refresh, access_expires_at: expiresAt(t), last_used_at: new Date().toISOString() };
    // compare-and-swap on the old refresh token: if another instance rotated first, use its fresh token
    const { data } = await (await db()).update(patch).eq("id_hash", row.id_hash).eq("enc_refresh", row.enc_refresh).select("id_hash").maybeSingle();
    if (!data) {
      const { data: fresh } = await (await db()).select("*").eq("id_hash", row.id_hash).maybeSingle();
      if (!fresh) throw new SiwcError("reauth", "session gone");
      return decrypt((fresh as SessionRow).enc_access);
    }
    Object.assign(row, patch);
    return t.access_token;
  })().finally(() => inflight.delete(row.id_hash));
  inflight.set(row.id_hash, p);
  return p;
}

async function touch(row: SessionRow) {
  // at most once an hour, to keep the idle window sliding without a write per request
  if (Date.now() - Date.parse(row.last_used_at) < 3600_000) return;
  await (await db()).update({ last_used_at: new Date().toISOString() }).eq("id_hash", row.id_hash);
}
