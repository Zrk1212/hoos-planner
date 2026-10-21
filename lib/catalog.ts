/**
 * Server-side catalog access (Supabase). Returns the slim projection the builder and advisor use.
 * The browser never talks to SIS; it only reads this cached snapshot.
 */
import { adminClient } from "./supabase/admin";
import type { Rating, Section } from "./types";
import { compactRatings, compactRow, hydrateRow, type WireCatalog, type WireRow } from "./catalog-wire";
import type { Catalog, RatingMap, TermInfo } from "./catalog-types";

export type { Catalog, RatingMap, TermInfo } from "./catalog-types";
export const DEFAULT_TERM = process.env.DEFAULT_TERM ?? "1272";

/** Slim wire projection: the full row lives in Postgres; the browser only needs what the builder/advisor use. */
const SECTION_COLS = [
  "class_nbr", "subject", "catalog_nbr", "class_section", "descr", "topic", "component",
  "units", "units_min", "units_max", "grading_basis", "acad_group", "start_dt", "end_dt",
  "enrl_stat", "class_capacity", "enrollment_total", "enrollment_available", "wait_tot", "rqmnt_designtn",
  "attrs", "instructor_names", "meetings", "reserve_caps",
].join(",");


export async function loadTerm(term = DEFAULT_TERM): Promise<TermInfo | null> {
  const db = adminClient();
  const { data } = await db.from("terms").select("*").eq("code", term).maybeSingle();
  return (data as TermInfo | null) ?? null;
}

export async function loadRawRows(term = DEFAULT_TERM): Promise<WireRow[]> {
  const db = adminClient();
  const out: WireRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from("sections").select(SECTION_COLS).eq("term", term).order("class_nbr").range(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as unknown as WireRow[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function loadSections(term = DEFAULT_TERM): Promise<Section[]> {
  return (await loadRawRows(term)).map((r) => hydrateRow(r, term));
}

export async function loadRatings(): Promise<RatingMap> {
  const db = adminClient();
  const map: RatingMap = {};
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from("courseforum_ratings").select("course,instructor,rating,difficulty,gpa,last_term").range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Rating[]) {
      const e = (map[r.course] ??= { overall: null, instructors: {} });
      const slim: Rating = { course: r.course, instructor: r.instructor, rating: r.rating, difficulty: r.difficulty, gpa: r.gpa, last_term: r.last_term, tcf_path: null };
      if (r.instructor === "") e.overall = slim; else e.instructors[r.instructor] = slim;
    }
    if (!data || data.length < page) break;
  }
  return map;
}

let cache: { key: string; at: number; value: Promise<{ catalog: Catalog; wire: WireCatalog }> } | null = null;
const TTL = 10 * 60 * 1000;

function fallbackTerm(term: string, count: number): TermInfo {
  return { code: term, name: termLabel(term), start_date: null, end_date: null, q_a_start: null, q_a_end: null, q_b_start: null, q_b_end: null, synced_at: null, section_count: count };
}
function termLabel(code: string): string {
  const m = code.match(/^1(\d{2})(\d)$/);
  if (!m) return code;
  return `${{ "2": "Spring", "6": "Summer", "8": "Fall", "1": "January" }[m[2]] ?? "Term"} ${2000 + parseInt(m[1], 10)}`;
}

/** Friend mode: a local server with no Supabase keys reads the public catalog API of the deployed app. */
function friendApi(): string | null {
  return process.env.HOOS_API && !process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.HOOS_API.replace(/\/$/, "") : null;
}

async function loadBoth(term: string): Promise<{ catalog: Catalog; wire: WireCatalog }> {
  const key = term;
  if (cache && cache.key === key && Date.now() - cache.at < TTL) return cache.value;
  const api = friendApi();
  if (api) {
    const value = (async () => {
      const r = await fetch(`${api}/api/catalog?term=${term}`);
      if (!r.ok) throw new Error(`catalog API ${r.status} from ${api}`);
      const wire = (await r.json()) as WireCatalog;
      const { hydrateRatings } = await import("./catalog-wire");
      return { wire, catalog: { term: wire.term, sections: wire.rows.map((row) => hydrateRow(row, term)), ratings: hydrateRatings(wire.ratings), generatedAt: wire.generatedAt } };
    })();
    cache = { key, at: Date.now(), value };
    value.catch(() => { cache = null; });
    return value;
  }
  const value = (async () => {
    const [t, rows, ratings] = await Promise.all([loadTerm(term), loadRawRows(term), loadRatings()]);
    const termInfo = t ?? fallbackTerm(term, rows.length);
    const sections = rows.map((r) => hydrateRow(r, term));
    const generatedAt = new Date().toISOString();
    const courses = new Set(sections.map((s) => s.course));
    return {
      catalog: { term: termInfo, sections, ratings, generatedAt },
      wire: { term: termInfo, rows: rows.map(compactRow), ratings: compactRatings(ratings, courses), generatedAt },
    };
  })();
  cache = { key, at: Date.now(), value };
  value.catch(() => { cache = null; });
  return value;
}

export async function loadCatalog(term = DEFAULT_TERM): Promise<Catalog> {
  return (await loadBoth(term)).catalog;
}

/** Compact payload for /api/catalog; the browser hydrates it with lib/catalog-wire.ts. */
export async function loadWireCatalog(term = DEFAULT_TERM): Promise<WireCatalog> {
  return (await loadBoth(term)).wire;
}

/** Best rating for a section: the co-instructor with real numbers wins, then course-level. */
export function ratingFor(ratings: RatingMap, course: string, instructorNames: string | null | undefined): { r: Rating | null; level: "instructor" | "course" | null } {
  const e = ratings[course];
  if (!e) return { r: null, level: null };
  const names = (instructorNames ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  const hits: Rating[] = [];
  for (const n of names) {
    const last = n.split(" ").pop()!.toLowerCase();
    const hit = Object.entries(e.instructors).find(([k]) => k.toLowerCase() === n.toLowerCase() || k.split(" ").pop()!.toLowerCase() === last);
    if (hit) hits.push(hit[1]);
  }
  const filled = (r: Rating) => (r.rating != null ? 1 : 0) + (r.difficulty != null ? 1 : 0) + (r.gpa != null ? 1 : 0);
  hits.sort((a, b) => filled(b) - filled(a));
  if (hits.length && filled(hits[0]) > 0) return { r: hits[0], level: "instructor" };
  if (e.overall && filled(e.overall) > 0) return { r: e.overall, level: "course" };
  return { r: hits[0] ?? e.overall ?? null, level: hits[0] ? "instructor" : e.overall ? "course" : null };
}
