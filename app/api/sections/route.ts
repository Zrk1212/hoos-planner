/**
 * Full SIS details (rooms, instructors, session, instruction mode, waitlist cap) for a handful of sections.
 * The catalog download leaves these out to stay small; the live Cart page asks for just the plan's sections.
 */
import { NextResponse } from "next/server";
import { DEFAULT_TERM } from "@/lib/catalog";
import { LIMITS, limitResponse } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = limitResponse(req, LIMITS.sections);
  if (limited) return limited;
  const url = new URL(req.url);
  const term = url.searchParams.get("term") ?? DEFAULT_TERM;
  const raw = (url.searchParams.get("nbrs") ?? "").split(",").filter(Boolean);
  if (!/^\d{4}$/.test(term) || raw.length === 0 || raw.length > 60 || !raw.every((n) => /^\d{5}$/.test(n))) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { data, error } = await adminClient().from("sections")
    .select("class_nbr,section_type,acad_org,session_descr,instruction_mode_descr,wait_cap,instructors,meetings")
    .eq("term", term).in("class_nbr", [...new Set(raw.map(Number))]);
  if (error) return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  return NextResponse.json({ sections: data ?? [] }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" } });
}
