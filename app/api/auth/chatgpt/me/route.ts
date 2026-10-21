/** Is ChatGPT sign-in on, and is this browser signed in? No tokens ever leave the server. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadSession } from "@/lib/chatgpt-session";
import { SESSION_COOKIE, siwcConfig } from "@/lib/siwc";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!siwcConfig().enabled) return NextResponse.json({ enabled: false, signedIn: false }, { headers: { "Cache-Control": "no-store" } });
  const row = await loadSession((await cookies()).get(SESSION_COOKIE)?.value).catch(() => null);
  return NextResponse.json({ enabled: true, signedIn: !!row, email: row?.email ?? null }, { headers: { "Cache-Control": "no-store" } });
}
