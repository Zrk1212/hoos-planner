/** Signs out: deletes the stored tokens and the cookie. POST only, so a link can't sign someone out. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/chatgpt-session";
import { SESSION_COOKIE } from "@/lib/siwc";

export async function POST() {
  const jar = await cookies();
  await deleteSession(jar.get(SESSION_COOKIE)?.value).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
