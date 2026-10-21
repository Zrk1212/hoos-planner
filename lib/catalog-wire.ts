/**
 * Wire format for /api/catalog and the client-side hydration back into the full Section type.
 * No server imports here: this module is shared by the browser (useCatalog) and the server (loadCatalog).
 */
import type { Meeting, Rating, Section } from "./types";
import type { RatingMap, TermInfo } from "./catalog-types";

/** Row as selected from Postgres (SECTION_COLS). Meetings may omit dates equal to the section's. */
export interface WireRow {
  class_nbr: number; subject: string; catalog_nbr: string; class_section: string | null; descr: string | null; topic: string | null;
  component: string | null; units: string | null; units_min: number | null; units_max: number | null; grading_basis: string | null;
  acad_group: string | null; start_dt: string | null; end_dt: string | null; enrl_stat: string | null; class_capacity: number | null;
  enrollment_total: number | null; enrollment_available: number | null; wait_tot: number | null; rqmnt_designtn: string | null;
  attrs: string[]; instructor_names: string | null;
  meetings: Array<{ days: Meeting["days"]; start: number | null; end: number | null; start_dt?: string | null; end_dt?: string | null }>;
  reserve_caps: Array<{ descr?: string; enrl_cap?: number }>;
}

/** [rating, difficulty, gpa, last_term] */
export type WireRating = [number | null, number | null, number | null, string | null];
export interface WireRatings { [course: string]: { o?: WireRating; i: Record<string, WireRating> } }

export interface WireCatalog { term: TermInfo; rows: WireRow[]; ratings: WireRatings; generatedAt: string }

export function hydrateRow(r: WireRow, term: string): Section {
  return {
    ...r, term, course: `${r.subject} ${r.catalog_nbr}`, section_type: null, acad_org: null, session_descr: null,
    wait_cap: null, instructors: [], instruction_mode_descr: null,
    meetings: (r.meetings ?? []).map((m) => ({
      days: m.days, start: m.start, end: m.end,
      start_dt: m.start_dt === undefined ? r.start_dt : m.start_dt, end_dt: m.end_dt === undefined ? r.end_dt : m.end_dt,
      facility: null, instructor: null,
    })),
    reserve_caps: (r.reserve_caps ?? []).map((c) => ({ descr: c.descr, enrl_cap: c.enrl_cap })),
  };
}

/** Drop per-meeting dates that equal the section's dates (the common case) to shrink the payload. */
export function compactRow(r: WireRow): WireRow {
  return {
    ...r,
    meetings: (r.meetings ?? []).map((m) => {
      const same = m.start_dt === r.start_dt && m.end_dt === r.end_dt;
      return same ? { days: m.days, start: m.start, end: m.end } : { days: m.days, start: m.start, end: m.end, start_dt: m.start_dt ?? null, end_dt: m.end_dt ?? null };
    }),
  };
}

export function hydrateRatings(w: WireRatings): RatingMap {
  const out: RatingMap = {};
  const mk = (course: string, instructor: string, v: WireRating): Rating => ({ course, instructor, rating: v[0], difficulty: v[1], gpa: v[2], last_term: v[3], tcf_path: null });
  for (const [course, e] of Object.entries(w)) {
    out[course] = { overall: e.o ? mk(course, "", e.o) : null, instructors: Object.fromEntries(Object.entries(e.i).map(([n, v]) => [n, mk(course, n, v)])) };
  }
  return out;
}

export function compactRatings(m: RatingMap, courses: Set<string>): WireRatings {
  const out: WireRatings = {};
  const tup = (r: Rating): WireRating => [r.rating, r.difficulty, r.gpa, r.last_term];
  for (const [course, e] of Object.entries(m)) {
    if (!courses.has(course)) continue;
    out[course] = { ...(e.overall ? { o: tup(e.overall) } : {}), i: Object.fromEntries(Object.entries(e.instructors).map(([n, r]) => [n, tup(r)])) };
  }
  return out;
}
