/**
 * Seed the catalog from the JSON dumps captured during the 2026-10-19 planning session
 * (data/seed/*.json) so the app works before the first live SIS sync.
 * Rows are marked source='seed'; a later sync-sis run overwrites them with source='sis'.
 *
 *   npx tsx scripts/seed.ts
 */
import "./_env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adminClient } from "../lib/supabase/admin";
import { fromSeedMeet, toIsoDate } from "../lib/meetings";
import { forUpsert, splitAttrs } from "../lib/sis";
import type { ReserveCap, Section } from "../lib/types";

const TERM = "1272";
const SEED = join(process.cwd(), "data", "seed");

interface SeedRow {
  subj?: string; sec: string; nbr: number; cat: string; descr: string; topic: string; comp: string; units: string;
  cap: number; enr: number; avail?: number; wait?: number; stat: string; session: string; start: string; end: string;
  mode: string; grading: string; attr?: string; attrv: string; rsv: string[]; instr: string; meet: string;
}

function parseUnits(u: string): [number | null, number | null] {
  const m = u?.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?/);
  if (!m) return [null, null];
  return [parseFloat(m[1]), m[2] ? parseFloat(m[2]) : parseFloat(m[1])];
}

function toSection(r: SeedRow, subject: string): Section & Record<string, unknown> {
  const [umin, umax] = parseUnits(r.units);
  const start_dt = toIsoDate(r.start);
  const end_dt = toIsoDate(r.end);
  const instructors = (r.instr || "").split(";").map((s) => s.trim()).filter((s) => s && s !== "To Be Announced").map((name) => ({ name }));
  const rsv: ReserveCap[] = (r.rsv || []).map((s) => { try { return JSON.parse(s) as ReserveCap; } catch { return { descr: s }; } });
  return {
    term: TERM, class_nbr: r.nbr, subject, catalog_nbr: r.cat, course: `${subject} ${r.cat}`,
    class_section: r.sec, descr: r.descr, topic: r.topic || null, component: r.comp, section_type: null,
    units: r.units, units_min: umin, units_max: umax, grading_basis: r.grading,
    acad_group: null, acad_org: null, acad_career: "UGRD", session_descr: r.session,
    start_dt, end_dt, enrl_stat: r.stat, class_capacity: r.cap, enrollment_total: r.enr,
    enrollment_available: r.avail ?? (r.cap - r.enr), wait_cap: null, wait_tot: r.wait ?? null,
    rqmnt_designtn: null, attrs: splitAttrs(r.attrv), crse_attr: r.attr ?? null, crse_attr_value: r.attrv || null,
    instructors, instructor_names: instructors.map((i) => i.name).join("; ") || null,
    meetings: fromSeedMeet(r.meet, start_dt, end_dt), reserve_caps: rsv, icons: [],
    instruction_mode_descr: r.mode, raw: null, source: "seed",
  };
}

async function main() {
  const db = adminClient();
  const rows = new Map<number, Section & Record<string, unknown>>();
  const add = (r: SeedRow, subj: string) => {
    const s = toSection(r, subj);
    const prev = rows.get(s.class_nbr);
    // prefer rows carrying attrs (discipline dump) over subject dump when both exist
    if (!prev || (s.attrs.length && !prev.attrs.length)) rows.set(s.class_nbr, { ...prev, ...s, attrs: s.attrs.length ? s.attrs : prev?.attrs ?? [] });
  };
  for (const f of ["spring2027_subjects.json", "spring2027_subjects2.json"]) {
    const d = JSON.parse(readFileSync(join(SEED, f), "utf8")) as Record<string, SeedRow[]>;
    for (const [subj, list] of Object.entries(d)) for (const r of list) add(r, subj);
  }
  for (const f of ["spring2027_disciplines.json", "spring2027_attrs.json"]) {
    const d = JSON.parse(readFileSync(join(SEED, f), "utf8")) as Record<string, SeedRow[]>;
    for (const list of Object.values(d)) for (const r of list) if (r.subj) add(r, r.subj);
  }
  console.log(`seed: ${rows.size} unique sections`);

  await db.from("terms").upsert({
    code: TERM, name: "Spring 2027", start_date: "2027-01-20", end_date: "2027-05-04",
    q_a_start: "2027-01-20", q_a_end: "2027-03-16", q_b_start: "2027-03-17", q_b_end: "2027-05-04",
  }, { onConflict: "code" });

  // never overwrite rows a live sync already wrote
  const { data: live } = await db.from("sections").select("class_nbr").eq("term", TERM).eq("source", "sis");
  const liveSet = new Set((live ?? []).map((r) => r.class_nbr));
  const all = [...rows.values()].filter((r) => !liveSet.has(r.class_nbr)).map((r) => forUpsert(r));
  for (let i = 0; i < all.length; i += 500) {
    const { error } = await db.from("sections").upsert(all.slice(i, i + 500), { onConflict: "term,class_nbr" });
    if (error) throw new Error(error.message);
    process.stdout.write(".");
  }
  console.log(`\nupserted ${all.length} (skipped ${liveSet.size} live rows)`);

  // Course Forum seed: discipline_rows.json (per-section instructor ratings) + EGMT instructor lists
  const ratings = new Map<string, { course: string; instructor: string; rating: number | null; difficulty: number | null; gpa: number | null; last_term: string | null; tcf_path: string | null }>();
  const num = (v: unknown) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null; };
  const disc = JSON.parse(readFileSync(join(SEED, "discipline_rows.json"), "utf8")) as Array<{ course: string; instr: string; rating: unknown; diff: unknown; gpa: unknown; src: string }>;
  for (const r of disc) {
    if (r.rating == null && r.diff == null && r.gpa == null) continue;
    const instructor = r.src === "instructor" ? r.instr : "";
    const key = `${r.course}|${instructor}`;
    if (!ratings.has(key)) ratings.set(key, { course: r.course, instructor, rating: num(r.rating), difficulty: num(r.diff), gpa: num(r.gpa), last_term: null, tcf_path: null });
  }
  const egmt = JSON.parse(readFileSync(join(SEED, "courseforum_egmt_instructors.json"), "utf8")) as Record<string, Array<{ name: string; last: string; rating: string; diff: string; gpa: string; path: string }>>;
  for (const [cat, list] of Object.entries(egmt)) {
    for (const r of list) {
      const name = r.name.replace(/^To Announced$/, "").trim();
      if (!name) continue;
      const key = `EGMT ${cat}|${name}`;
      if (!ratings.has(key)) ratings.set(key, { course: `EGMT ${cat}`, instructor: name, rating: num(r.rating), difficulty: num(r.diff), gpa: num(r.gpa), last_term: r.last, tcf_path: r.path });
    }
  }
  // Hand-verified numbers from the planning brief for courses outside the dumps
  const brief: Array<[string, string, number | null, number | null, number | null]> = [
    ["DS 1001", "Brian Wright", 3.4, 1.9, 3.88], ["DS 1002", "Jianxin Xie", 4.3, 1.0, 3.92],
    ["CS 1110", "Arohi Khargonkar", 3.7, 2.9, 3.40], ["STAT 2120", "", 3.5, 3.0, 3.11],
    ["MUSI 2072", "Scott DeVeaux", 4.0, 1.0, null], ["MUSI 2072", "", null, 1.0, null],
    ["SLAV 2360", "Stanley Stepanic", 4.6, 1.6, 3.78], ["RELB 2900", "", null, 1.0, null],
    ["ENGL 2508", "Charity Fowler", 5.0, 2.0, 3.91], ["ENGL 1500", "Stephen Hopkins", 5.0, 2.0, 3.41],
    ["ARTH 2882", "Henry Skerritt", 5.0, 1.8, 3.72], ["MDST 2810", "Matthew Marshall", 4.3, 1.9, 3.94],
    ["PHIL 1330", "Ross Cameron", 3.2, 2.0, 3.74], ["PHIL 2640", "Brie Gertler", 4.4, 2.5, 3.48],
    ["PHIL 2060", "", 3.8, 2.9, 3.72], ["PHIL 1730", "Jordan MacKenzie", 4.5, 2.0, 3.75],
    ["EBUS 2830", "", 5.0, 2.0, 3.94],
  ];
  for (const [course, instructor, rating, difficulty, gpa] of brief) {
    const key = `${course}|${instructor}`;
    if (!ratings.has(key)) ratings.set(key, { course, instructor, rating, difficulty, gpa, last_term: null, tcf_path: null });
  }
  const rl = [...ratings.values()];
  for (let i = 0; i < rl.length; i += 500) {
    const { error } = await db.from("courseforum_ratings").upsert(rl.slice(i, i + 500), { onConflict: "course,instructor" });
    if (error) throw new Error(error.message);
  }
  console.log(`ratings upserted: ${rl.length}`);
  await db.from("sync_log").insert({ kind: "seed", term: TERM, finished_at: new Date().toISOString(), rows: all.length, requests: 0, note: `${rl.length} ratings` });
}

main().catch((e) => { console.error(e); process.exit(1); });
