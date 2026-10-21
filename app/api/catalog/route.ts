import { NextResponse } from "next/server";
import { LIMITS, limitResponse } from "@/lib/rate-limit";
import { DEFAULT_TERM, loadWireCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = limitResponse(req, LIMITS.catalog);
  if (limited) return limited;
  const url = new URL(req.url);
  const term = url.searchParams.get("term") ?? DEFAULT_TERM;
  if (!/^\d{4}$/.test(term)) return NextResponse.json({ error: "bad term" }, { status: 400 });
  const wire = await loadWireCatalog(term);
  return NextResponse.json(wire, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
