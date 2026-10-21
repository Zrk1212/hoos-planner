/**
 * Nightly SIS catalog sync. Pulls every section of a term into public.sections (idempotent upsert).
 *
 *   npx tsx scripts/sync-sis.ts                 # DEFAULT_TERM (1272)
 *   npx tsx scripts/sync-sis.ts --term 1272
 *   npx tsx scripts/sync-sis.ts --subjects DS,CS,EGMT   # partial refresh
 *   npx tsx scripts/sync-sis.ts --attrs                 # also verify the attribute lists
 *   npx tsx scripts/sync-sis.ts --from 85               # resume a full pull from page 85 (no stale cleanup)
 *
 * Policy: server-side only, ~95 requests per full pull, 400 ms apart. Never call per user.
 */
import "./_env";
import { adminClient } from "../lib/supabase/admin";
import { SisSession, forUpsert, inferTermDates, normalizeSis, termName } from "../lib/sis";
import type { Section } from "../lib/types";

const ATTR_CODES = ["AIP", "CMP", "CSW", "HP", "LS", "SS", "SES", "QCD", "R21C2", "R21C1", "WL"];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const term = arg("term") ?? process.env.DEFAULT_TERM ?? "1272";
  const subjects = arg("subjects")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const withAttrs = process.argv.includes("--attrs");
  const fromPage = parseInt(arg("from") ?? "1", 10);
  const db = adminClient();
  const sis = new SisSession();

  const { data: log } = await db.from("sync_log").insert({ kind: "sis", term }).select("id").single();
  const logId = log?.id;

  await db.from("terms").upsert({ code: term, name: termName(term) }, { onConflict: "code" });

  const startedAt = new Date().toISOString();
  const rows = new Map<number, Section & Record<string, unknown>>();
  const queries: Record<string, string>[] = subjects?.length
    ? subjects.map((s) => ({ term, subject: s }))
    : [{ term }];
  if (withAttrs) for (const a of ATTR_CODES) queries.push({ term, crse_attr_value: a });

  let batch = 0;
  // upsert page by page so a network failure mid-pull still leaves fresh rows behind
  for (const q of queries) {
    process.stdout.write(`query ${JSON.stringify(q)} `);
    let n = 0;
    // --from resumes only the main whole-term query; subject/attribute queries have their own page counts
    const isMainQuery = Object.keys(q).every((k) => k === "term");
    for await (const page of sis.searchAll(q, 400, isMainQuery ? fromPage : 1)) {
      const chunk = page.map((r) => normalizeSis(r, term));
      for (const r of chunk) rows.set(r.class_nbr, r);
      let lastErr: string | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const { error } = await db.from("sections").upsert(chunk.map((r) => forUpsert(r, startedAt)), { onConflict: "term,class_nbr" });
          if (!error) { lastErr = null; break; }
          lastErr = error.message;
        } catch (e) { lastErr = String(e); }
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
      if (lastErr) throw new Error(`upsert failed: ${lastErr}`);
      batch++;
      n += page.length;
      process.stdout.write(".");
    }
    console.log(` ${n} rows`);
  }

  const all = [...rows.values()];
  console.log(`pulled ${all.length} sections in ${sis.requests} requests, ${batch} upsert batches`);

  if (!subjects?.length) {
    // Full pull: drop sections that disappeared from SIS (only when we started at page 1), and refresh term dates.
    if (fromPage === 1) {
      const keep = new Set(all.map((r) => r.class_nbr));
      const { data: existing } = await db.from("sections").select("class_nbr").eq("term", term);
      const stale = (existing ?? []).map((r) => r.class_nbr).filter((n) => !keep.has(n));
      if (stale.length) {
        for (let i = 0; i < stale.length; i += 500) {
          await db.from("sections").delete().eq("term", term).in("class_nbr", stale.slice(i, i + 500));
        }
        console.log(`removed ${stale.length} stale sections`);
      }
    }
    const { data: liveRows } = await db.from("sections").select("start_dt,end_dt").eq("term", term).eq("source", "sis").limit(20000);
    const { count: total } = await db.from("sections").select("*", { count: "exact", head: true }).eq("term", term);
    const d = inferTermDates((liveRows ?? []) as Section[]);
    await db.from("terms").upsert({
      code: term, name: termName(term), start_date: d.start, end_date: d.end,
      q_a_start: d.qa?.[0] ?? null, q_a_end: d.qa?.[1] ?? null,
      q_b_start: d.qb?.[0] ?? null, q_b_end: d.qb?.[1] ?? null,
      synced_at: new Date().toISOString(), section_count: total ?? all.length,
    }, { onConflict: "code" });
  } else {
    await db.from("terms").update({ synced_at: new Date().toISOString() }).eq("code", term);
  }

  if (logId) {
    await db.from("sync_log").update({ finished_at: new Date().toISOString(), rows: all.length, requests: sis.requests, note: `${batch} batches` }).eq("id", logId);
  }
  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
