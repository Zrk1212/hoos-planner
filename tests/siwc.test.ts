import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { authorizeUrl, decrypt, encrypt, hasPlanScope, pkce, refreshTokens } from "@/lib/siwc";

beforeEach(() => { process.env.OPENAI_SIWC_CLIENT_ID = "oaiapp_test"; process.env.SIWC_ENABLED = "1"; });

describe("sign in with ChatGPT helpers", () => {
  it("builds a PKCE S256 pair", () => {
    const { verifier, challenge } = pkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });
  it("asks for plan usage and the API resource", () => {
    const u = new URL(authorizeUrl({ state: "s", nonce: "n", challenge: "c", clientId: "oaiapp_test", redirectUri: "https://x/cb" }));
    expect(u.searchParams.get("scope")).toContain("chatgpt.tokens.use.direct");
    expect(u.searchParams.get("resource")).toBe("https://api.openai.com/v1");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  });
  it("requires the plan scope in the token response", () => {
    expect(hasPlanScope({ access_token: "a", scope: "openid profile email" })).toBe(false);
    expect(hasPlanScope({ access_token: "a", scope: "openid offline_access chatgpt.tokens.use.direct" })).toBe(true);
  });
  it("encrypts tokens and rejects tampering", () => {
    const key = randomBytes(32);
    const sealed = encrypt("secret-token", key);
    expect(decrypt(sealed, key)).toBe("secret-token");
    const parts = sealed.split(".");
    parts[2] = Buffer.from("x" + Buffer.from(parts[2], "base64url").toString("latin1")).toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
  });
  it("maps a revoked refresh token to re-auth", async () => {
    const f = (async () => new Response('{"error":"invalid_grant"}', { status: 400 })) as unknown as typeof fetch;
    await expect(refreshTokens("old", f)).rejects.toMatchObject({ kind: "reauth" });
  });
});
