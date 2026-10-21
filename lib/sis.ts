/**
 * SIS public class-search JSON (no login). Server-side only.
 *
 * Endpoint: https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch
 *   ?institution=UVA01&term=1272&subject=DS&page=1   (100 rows/page; pageCount on every page)
 *   crse_attr_value=AIP|CMP|CSW|HP|LS|SS|SES|QCD|R21C2|R21C1|WL, keyword=..., catalog_nbr=...
 * Omitting subject/attr returns the whole term (~94 pages for Spring 2027).
 *
 * The endpoint 403s ("CSA5 Error") without a PeopleSoft guest session, so we first GET the
 * public landing page (IScript_Main) to collect cookies, then reuse them for every page.
 * Keep volume low: one full pull per night, never per user, never from the browser.
 */
import { fromSisMeeting, toIsoDate } from "./meetings";
import type { Instructor, Meeting, ReserveCap, Section } from "./types";

export const SIS_BASE = "https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s";
export const SIS_SEARCH = `${SIS_BASE}/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch`;
export const SIS_LANDING = `${SIS_BASE}/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_Main?institution=UVA01`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface SisRaw {
  crse_id: string; crse_offer_nbr: number; strm: string; session_code: string; session_descr: string;
  class_section: string; location: string; location_descr: string; start_dt: string; end_dt: string;
  class_stat: string; campus: string; class_nbr: number; acad_career: string; component: string;
  subject: string; subject_descr: string; catalog_nbr: string; class_type: string; schedule_print: string;
  acad_group: string; instruction_mode: string; instruction_mode_descr: string; acad_org: string;
  grading_basis: string; wait_tot: number; wait_cap: number; class_capacity: number; enrollment_total: number;
  enrollment_available: number; descr: string; rqmnt_designtn: string; units: string; combined_section: string;
  enrl_stat: string; enrl_stat_descr: string; topic: string; instructors: Instructor[]; section_type: string;
  meetings: Array<{ days: string; start_time: string; end_time: string; start_dt: string; end_dt: string; facility_descr: string; instructor: string }>;
  crse_attr: string; crse_attr_value: string; reserve_caps: ReserveCap[] | string[]; icons: unknown[];
}

export interface SisPage { pageCount: number; classes: SisRaw[] }

export class SisSession {
  private cookies = new Map<string, string>();
  requests = 0;

  private cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  private absorb(res: Response) {
    const set = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const c of set) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      if (i > 0) this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
  }
  private async get(url: string): Promise<Response> {
    this.requests++;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json, text/html;q=0.9, */*;q=0.8", Cookie: this.cookieHeader() },
      redirect: "manual",
    });
    this.absorb(res);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) return this.get(new URL(loc, url).toString());
    }
    return res;
  }
  /** Obtain the PeopleSoft guest cookies. */
  async open() {
    const res = await this.get(SIS_LANDING);
    if (!res.ok) throw new Error(`SIS landing ${res.status}`);
    await res.text();
  }
  async search(params: Record<string, string | number>, attempts = 6): Promise<SisPage> {
    if (!this.cookies.size) await this.open();
    const q = new URLSearchParams({ institution: "UVA01", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await this.get(`${SIS_SEARCH}?${q.toString()}&`);
        const text = await res.text();
        if (!res.ok || !text.trim().startsWith("{")) {
          // session may have expired: re-open once, then retry
          if (res.status === 403 || /interrupted/i.test(text)) { this.cookies.clear(); await this.open(); }
          throw new Error(`SIS search ${res.status}: ${text.slice(0, 120).replace(/\s+/g, " ")}`);
        }
        return JSON.parse(text) as SisPage;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, Math.min(120_000, 3000 * (i + 1) ** 2)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
  /** Iterate every page of a query, politely. */
  async *searchAll(params: Record<string, string | number>, delayMs = 400, startPage = 1): AsyncGenerator<SisRaw[], void, void> {
    // pageCount is only populated on page 1 (later pages report 0)
    const first = await this.search({ ...params, page: 1 });
    if (startPage <= 1) yield first.classes;
    for (let p = Math.max(2, startPage); p <= first.pageCount; p++) {
      await new Promise((r) => setTimeout(r, delayMs));
      const page = await this.search({ ...params, page: p });
      yield page.classes;
    }
  }
}

function parseUnits(units: string | null | undefined): { min: number | null; max: number | null } {
  if (!units) return { min: null, max: null };
  const m = units.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?/);
  if (!m) return { min: null, max: null };
  const min = parseFloat(m[1]);
  return { min, max: m[2] ? parseFloat(m[2]) : min };
}

export function splitAttrs(v: string | null | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseReserveCaps(rc: unknown): ReserveCap[] {
  if (!Array.isArray(rc)) return [];
  return rc.map((x) => {
    if (typeof x === "string") { try { return JSON.parse(x) as ReserveCap; } catch { return { descr: x }; } }
    return x as ReserveCap;
  });
}

/** Raw SIS row -> sections table row (full). */
export function normalizeSis(r: SisRaw, term?: string): Record<string, unknown> & Section {
  const meetings: Meeting[] = (r.meetings ?? []).map(fromSisMeeting);
  const { min, max } = parseUnits(r.units);
  const instructors = r.instructors ?? [];
  return {
    term: term ?? r.strm,
    class_nbr: r.class_nbr,
    crse_id: r.crse_id,
    crse_offer_nbr: r.crse_offer_nbr,
    subject: r.subject,
    catalog_nbr: r.catalog_nbr,
    course: `${r.subject} ${r.catalog_nbr}`,
    class_section: r.class_section,
    descr: r.descr,
    topic: r.topic || null,
    component: r.component,
    section_type: r.section_type,
    units: r.units,
    units_min: min,
    units_max: max,
    grading_basis: r.grading_basis,
    acad_group: r.acad_group,
    acad_org: r.acad_org,
    acad_career: r.acad_career,
    campus: r.campus,
    location: r.location,
    instruction_mode: r.instruction_mode,
    instruction_mode_descr: r.instruction_mode_descr,
    session_code: r.session_code,
    session_descr: r.session_descr,
    start_dt: toIsoDate(r.start_dt),
    end_dt: toIsoDate(r.end_dt),
    class_stat: r.class_stat,
    enrl_stat: r.enrl_stat,
    enrl_stat_descr: r.enrl_stat_descr,
    class_capacity: r.class_capacity,
    enrollment_total: r.enrollment_total,
    enrollment_available: r.enrollment_available,
    wait_cap: r.wait_cap,
    wait_tot: r.wait_tot,
    combined_section: r.combined_section,
    schedule_print: r.schedule_print,
    class_type: r.class_type,
    rqmnt_designtn: r.rqmnt_designtn || null,
    crse_attr: r.crse_attr || null,
    crse_attr_value: r.crse_attr_value || null,
    attrs: splitAttrs(r.crse_attr_value),
    instructors,
    instructor_names: instructors.map((i) => i.name).join("; ") || null,
    meetings,
    reserve_caps: parseReserveCaps(r.reserve_caps),
    icons: r.icons ?? [],
    raw: r,
    source: "sis",
  };
}

/** The `course` column is generated in Postgres; strip it before upsert. */
export function forUpsert(row: Record<string, unknown>, touchedAt: string = new Date().toISOString()): Record<string, unknown> {
  const { course: _course, ...rest } = row;
  void _course;
  // sections has no updated_at trigger: stamp every upsert so a sync can tell fresh rows from stale ones
  return { ...rest, updated_at: touchedAt };
}

/** Spring/Fall halves from the section dates seen in a pull. */
export function inferTermDates(rows: Section[]): { start: string | null; end: string | null; qa: [string, string] | null; qb: [string, string] | null } {
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  for (const r of rows) {
    if (r.start_dt) starts.set(r.start_dt, (starts.get(r.start_dt) ?? 0) + 1);
    if (r.end_dt) ends.set(r.end_dt, (ends.get(r.end_dt) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const start = top(starts);
  const end = top(ends);
  // EGMT-style halves: most common end date among sections that end before term end, etc.
  const halfEnds = [...ends.entries()].filter(([d]) => end && d < end).sort((a, b) => b[1] - a[1]);
  const halfStarts = [...starts.entries()].filter(([d]) => start && d > start).sort((a, b) => b[1] - a[1]);
  const qaEnd = halfEnds[0]?.[0] ?? null;
  const qbStart = halfStarts[0]?.[0] ?? null;
  return {
    start, end,
    qa: start && qaEnd ? [start, qaEnd] : null,
    qb: qbStart && end ? [qbStart, end] : null,
  };
}

export function termName(code: string): string {
  // PeopleSoft strm: 1 + YY + semester (2 = spring, 6 = summer, 8 = fall) for UVA
  const m = code.match(/^1(\d{2})(\d)$/);
  if (!m) return code;
  const yr = 2000 + parseInt(m[1], 10);
  const sem = { "2": "Spring", "6": "Summer", "8": "Fall", "1": "January" }[m[2]] ?? "Term";
  return `${sem} ${yr}`;
}
