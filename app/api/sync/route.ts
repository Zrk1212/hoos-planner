/**
 * Nightly catalog refresh, triggered by Vercel Cron (vercel.json) or manually with the SYNC_SECRET header.
 * Runs the same code as scripts/sync-sis.ts for the default term. Never triggered by page views.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { SisSession, forUpsert, inferTermDates, normalizeSis, termName } from "@/lib/sis";
import type { Section } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secrets = [process.env.CRON_SECRET, process.env.SYNC_SECRET].filter((s): s is string => !!s);
  if (!secrets.length || !secrets.some((s) => sameSecret(auth, `Bearer ${s}`))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const term = new URL(req.url).searchParams.get("term") ?? process.env.DEFAULT_TERM ?? "1272";
  if (!/^\d{4}$/.test(term)) return NextResponse.json({ error: "bad term" }, { status: 400 });
  const db = adminClient();
  const sis = new SisSession();
  const { data: log } = await db.from("sync_log").insert({ kind: "sis", term }).select("id").single();
  const startedAt = new Date().toISOString();
  const { data: prevTerm } = await db.from("terms").select("section_count").eq("code", term).maybeSingle();
  const rows = new Map<number, Section & Record<string, unknown>>();
  // upsert page by page so a mid-pull failure still leaves fresh rows behind; every row is stamped with this run's time
  for await (const page of sis.searchAll({ term })) {
    const chunk = page.map((r) => normalizeSis(r, term));
    for (const r of chunk) rows.set(r.class_nbr, r);
    const { error } = await db.from("sections").upsert(chunk.map((r) => forUpsert(r, startedAt)), { onConflict: "term,class_nbr" });
    if (error) return NextResponse.json({ error: error.message, pulled: rows.size }, { status: 500 });
  }
  const all = [...rows.values()];
  // Cancelled sections: rows this run did not touch. Guarded: only after a complete pull that is at least 90% of
  // the previous count, so a truncated or partial pull can never wipe the catalog.
  let removed = 0;
  const prevCount = prevTerm?.section_count ?? 0;
  if (all.length >= Math.floor(prevCount * 0.9)) {
    const { count } = await db.from("sections").delete({ count: "exact" }).eq("term", term).lt("updated_at", startedAt);
    removed = count ?? 0;
  }
  const d = inferTermDates(all);
  await db.from("terms").upsert({
    code: term, name: termName(term), start_date: d.start, end_date: d.end,
    q_a_start: d.qa?.[0] ?? null, q_a_end: d.qa?.[1] ?? null, q_b_start: d.qb?.[0] ?? null, q_b_end: d.qb?.[1] ?? null,
    synced_at: new Date().toISOString(), section_count: all.length,
  }, { onConflict: "code" });
  if (log?.id) await db.from("sync_log").update({ finished_at: new Date().toISOString(), rows: all.length, requests: sis.requests }).eq("id", log.id);
  return NextResponse.json({ ok: true, term, sections: all.length, removed, skippedCleanup: all.length < Math.floor(prevCount * 0.9), requests: sis.requests });
}
