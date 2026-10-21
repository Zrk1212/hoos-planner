/**
 * Refresh theCourseForum ratings for every course present in a term.
 * Polite: ≤2 requests/second, on-disk cache (data/cache/tcf/*.html, 7 days), course-level + per-instructor rows.
 *
 *   npx tsx scripts/sync-courseforum.ts [--term 1272] [--max 200] [--force]
 */
import "./_env";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adminClient } from "../lib/supabase/admin";
import { parseCoursePage } from "../lib/courseforum";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CACHE = join(process.cwd(), "data", "cache", "tcf");
const MIN_GAP_MS = 500; // 2 req/s
const CACHE_TTL_MS = 7 * 86400000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BACKOFF_MS = [5000, 15000, 45000];

/** GET with backoff on 429/5xx and on a rejected fetch (network blip); null after the retries are spent. */
async function fetchWithBackoff(url: string): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA } });
    } catch (e) {
      if (attempt >= BACKOFF_MS.length) { console.warn(`${url}: ${(e as Error).message} (giving up)`); return null; }
      console.warn(`${url}: ${(e as Error).message}; retrying in ${BACKOFF_MS[attempt] / 1000}s`);
      await sleep(BACKOFF_MS[attempt]);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= BACKOFF_MS.length) { console.warn(`${url}: HTTP ${res.status} (giving up)`); return null; }
      console.warn(`${url}: HTTP ${res.status}; retrying in ${BACKOFF_MS[attempt] / 1000}s`);
      await sleep(BACKOFF_MS[attempt]);
      continue;
    }
    return res;
  }
}

async function main() {
  const term = arg("term") ?? process.env.DEFAULT_TERM ?? "1272";
  const max = parseInt(arg("max") ?? "100000", 10);
  const force = process.argv.includes("--force");
  mkdirSync(CACHE, { recursive: true });
  const db = adminClient();

  const { data: log } = await db.from("sync_log").insert({ kind: "courseforum", term }).select("id").single();

  // distinct courses in the term, lectures/seminars first
  const courses = new Set<string>();
  let from = 0;
  for (;;) {
    // stable order: range() pagination without ORDER BY can skip or repeat rows between pages
    const { data, error } = await db.from("sections").select("subject,catalog_nbr").eq("term", term).order("class_nbr").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) courses.add(`${r.subject} ${r.catalog_nbr}`);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  const list = [...courses].sort().slice(0, max);
  console.log(`${list.length} courses in term ${term}`);

  let requests = 0, rows = 0, last = 0;
  for (const course of list) {
    const [subject, catalog] = course.split(" ");
    const file = join(CACHE, `${subject}_${catalog}.html`);
    let html: string | null = null;
    if (!force && existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_TTL_MS) {
      html = readFileSync(file, "utf8");
    } else {
      const wait = MIN_GAP_MS - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      last = Date.now();
      requests++;
      const res = await fetchWithBackoff(`https://thecourseforum.com/course/${subject}/${catalog}/?latest=false`);
      if (!res) continue; // network rejection or persistent 429/5xx: move on to the next course
      if (res.status === 404) { writeFileSync(file, ""); continue; }
      if (!res.ok) { console.warn(`${course}: ${res.status}`); continue; }
      html = await res.text();
      writeFileSync(file, html);
    }
    if (!html) continue;
    const parsed = parseCoursePage(html, course);
    const now = new Date().toISOString();
    const upserts = parsed.instructors.map((i) => ({ course, instructor: i.name, rating: i.rating, difficulty: i.difficulty, gpa: i.gpa, last_term: i.last_term, tcf_path: i.path, fetched_at: now }));
    if (parsed.overall.rating != null || parsed.overall.gpa != null || parsed.overall.difficulty != null) {
      upserts.push({ course, instructor: "", rating: parsed.overall.rating, difficulty: parsed.overall.difficulty, gpa: parsed.overall.gpa, last_term: null, tcf_path: `/course/${subject}/${catalog}/`, fetched_at: now });
    }
    if (upserts.length) {
      const { error } = await db.from("courseforum_ratings").upsert(upserts, { onConflict: "course,instructor" });
      if (error) throw new Error(error.message);
      rows += upserts.length;
    }
    if (requests % 25 === 0 && requests) process.stdout.write(`${requests} fetched, ${rows} rows\n`);
  }
  if (log?.id) await db.from("sync_log").update({ finished_at: new Date().toISOString(), rows, requests }).eq("id", log.id);
  console.log(`done: ${requests} requests, ${rows} rating rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
