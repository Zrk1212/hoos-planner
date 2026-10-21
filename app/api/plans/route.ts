/**
 * Plan codes over HTTP, for local servers running in friend mode (no Supabase keys).
 * Same semantics and caps as the MCP save_plan/load_plan tools; the 20-hex code is the only secret.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { GoalsSchema, PlanCode, ProfileSchema, cleanText, toProfile } from "@/lib/plan-schema";
import { supabasePlanStore } from "@/lib/plans";
import { LIMITS, bodyTooLarge, limitResponse, readBodyCapped } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = limitResponse(req, LIMITS.plansGet);
  if (limited) return limited;
  const params = new URL(req.url).searchParams;
  const code = params.get("code") ?? "";
  if (!PlanCode.safeParse(code).success) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const { row, error } = await supabasePlanStore().load(code);
  if (error) return NextResponse.json({ error }, { status: 500 });
  // the website polls a fresh code until Claude's first save: ?soft=1 answers 200 so the console stays clean
  if (!row) return params.get("soft") === "1"
    ? NextResponse.json({ missing: true }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
}

/** Deletes the plan: the code is the only key, same as for reading and writing it. */
export async function DELETE(req: Request) {
  const limited = limitResponse(req, LIMITS.plansPost);
  if (limited) return limited;
  const code = PlanCode.safeParse(new URL(req.url).searchParams.get("code") ?? "");
  if (!code.success) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const { error } = await supabasePlanStore().remove(code.data);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

const Body = z.object({
  code: PlanCode.optional(),
  term: z.string().regex(/^\d{4}$/).optional(), // left out on update = keep; a new plan gets DEFAULT_TERM
  profile: ProfileSchema.nullable().optional(),
  cart: z.array(z.object({
    class_nbr: z.number().int().min(10000).max(99999),
    backup: z.boolean().optional(),
    replaces: z.number().int().min(10000).max(99999).optional(),
  })).max(60).optional(),
  notes: z.string().max(2000).transform(cleanText).nullable().optional(),
  meta: z.object({ goals: GoalsSchema.optional() }).nullable().optional(),
  if_updated_at: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const limited = limitResponse(req, LIMITS.plansPost) ?? bodyTooLarge(req, 120_000);
  if (limited) return limited;
  // JSON only: a text/plain POST is a CORS "simple" request any web page could send
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return NextResponse.json({ error: "send application/json" }, { status: 415 });
  const raw = await readBodyCapped(req, 120_000);
  if (raw instanceof Response) return raw;
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const b = parsed.data;
  // dedupe by class number, first entry wins; at most 40 main sections and 20 backups
  const seen = new Set<number>();
  const cart = b.cart?.filter((c) => !seen.has(c.class_nbr) && (seen.add(c.class_nbr), true))
    .map((c) => {
      const mainNbrs = new Set(b.cart!.filter((x) => !x.backup).map((x) => x.class_nbr));
      return c.backup && c.replaces && mainNbrs.has(c.replaces) && c.replaces !== c.class_nbr
        ? { class_nbr: c.class_nbr, backup: true, replaces: c.replaces }
        : c.backup ? { class_nbr: c.class_nbr, backup: true } : { class_nbr: c.class_nbr };
    });
  if (cart && (cart.filter((c) => !c.backup).length > 40 || cart.filter((c) => c.backup).length > 20)) return NextResponse.json({ error: "cart too long" }, { status: 400 });
  // absent fields keep their saved value on update (see PlanStore.save)
  const res = await supabasePlanStore().save(b.code, {
    term: b.term, cart,
    profile: b.profile === undefined ? undefined : b.profile ? toProfile(b.profile) : null,
    notes: b.notes,
    meta: b.meta === undefined ? undefined : (b.meta ?? {}),
  }, { ifUpdatedAt: b.if_updated_at });
  if (res.conflict) return NextResponse.json({ error: "changed since read" }, { status: 409 });
  if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ code: res.code, created: !!res.created });
}
