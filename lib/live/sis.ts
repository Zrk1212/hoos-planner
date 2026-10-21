/**
 * Live SIS reads through the user's own signed-in Chrome tab (Highpoint CX JSON IScripts).
 * Endpoints discovered 2026-10-20 (see docs/live-endpoints.md). Cart writes live in sis-write.ts.
 */
import { fromSisMeeting } from "../meetings";
import { isPassing } from "../requirements";
import type { Meeting, Profile, ProfileCourse } from "../types";
import { LiveError, runPy } from "./runner";

export const SIS_PSC = "https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/";
export const SIS_PSP = "https://sisuva.admin.virginia.edu/psp/ihprd/UVSS/SA/s/";
const CART = "WEBLIB_HCX_EN.H_SHOPPING_CART.FieldFormula.";
const TRANSCR = "WEBLIB_HCX_RE.H_VW_UNOFF_TRANSCR.FieldFormula.";

/**
 * Python prologue: find (or open) an SIS tab, attach, and define fetch helpers that run inside the page so the
 * PeopleSoft cookies apply. Uses the user's existing SIS tab read-only (no activation, no navigation) when one
 * exists; otherwise opens our own window on the dashboard (`own`), which every caller closes in `finally`.
 */
const SIS_PROLOGUE = `
import json, time
t = find_target("sisuva.admin.virginia.edu")
own = None
sid = None
EXPIRED = "SIS session expired (PeopleSoft logs you out after 10 minutes idle). Sign in to SIS again in Chrome (NetBadge + Duo), then retry."
def looks_signed_out(u, title=""):
    u = (u or "").lower(); title = (title or "").lower()
    return ("cmd=expire" in u or "signon" in u or "netbadge" in u or "shibboleth" in u or "cmd=login" in u or "expired" in title)
if t:
    sid = attach(t["targetId"])
    if evaluate(sid, "location.origin") != "https://sisuva.admin.virginia.edu" or looks_signed_out(current_url(sid), evaluate(sid, "document.title")):
        sid = None
if sid is None:
    own, sid = open_window(${JSON.stringify(SIS_PSP + "WEBLIB_HCX_GN.H_DASHBOARD.FieldFormula.IScript_Main")})
    time.sleep(2)
    if evaluate(sid, "location.origin") != "https://sisuva.admin.virginia.edu" or looks_signed_out(current_url(sid), evaluate(sid, "document.title")):
        fail(EXPIRED)
url = current_url(sid)
def sis(path, method="GET"):
    r = evaluate(sid, "fetch(%s,{method:%s,credentials:'include'}).then(r=>r.text()).then(t=>{try{return JSON.parse(t)}catch(e){return {__raw:t.slice(0,600)}}}).catch(e=>({__raw:'fetchfail '+String(e)}))" % (json.dumps(${JSON.stringify(SIS_PSC)} + path), json.dumps(method)), 90)
    raw = (r or {}).get("__raw") if isinstance(r, dict) else None
    if raw and ("fetchfail" in raw or "signon" in raw.lower() or "expire" in raw.lower() or "<html" in raw.lower()):
        fail(EXPIRED)
    return r
def close_own():
    if own: close(own)
`;

export interface CartClass {
  subject: string; catalog_nbr: string; class_section: string; class_nbr: number; descr: string; component: string;
  unt_taken: number | string; related: boolean; enrl_stat: string; enrl_stat_code: string; enrl_tot: number; enrl_cap: number;
  wait_tot: number; wait_cap: number; meetings: Array<{ days: string; start_time: string; end_time: string; start_dt: string; end_dt: string; facility_descr: string; instructor: string }>;
  relate_class_nbr_1?: number; relate_class_nbr_2?: number; reserve_caps: unknown[];
}
export interface CartData {
  student_name: string; term: string; term_descr: string; classes: CartClass[]; is_enrolled: boolean; show_enroll: boolean;
  enrollment_terms?: Array<{ strm: string; descr: string }>;
}

function signedInGuard(json: unknown): void {
  const raw = (json as { __raw?: string } | null)?.__raw;
  if (raw && /<html|signon|netbadge|interrupted/i.test(raw)) throw new LiveError("SIS session is not signed in. Sign in to SIS (NetBadge + Duo) in Chrome, then retry.");
}

export async function readCart(term: string): Promise<{ cart: CartData; url: string }> {
  const { json } = await runPy(`${SIS_PROLOGUE}
try:
    data = sis("${CART}IScript_ShoppingCartData?institution=UVA01&term=${term}&acad_career=UGRD")
    emit({"url": url, "cart": data})
finally:
    close_own()`);
  const j = json as { url: string; cart: CartData & { __raw?: string } };
  signedInGuard(j.cart);
  if (!j.cart?.classes) throw new LiveError(`Unexpected cart response: ${JSON.stringify(j.cart).slice(0, 300)}`);
  return { cart: j.cart, url: j.url };
}

export async function readEnrollmentDates(): Promise<string> {
  const { json } = await runPy(`${SIS_PROLOGUE}
try:
    tid2, sid2 = open_window(${JSON.stringify(SIS_PSP + "WEBLIB_HCX_EN.H_ENROLLMENT_DATES.FieldFormula.IScript_Main")})
    try:
        txt = ""
        for _ in range(20):
            txt = frame_text(sid2)
            if len(txt) > 200: break
            time.sleep(1)
    finally:
        close(tid2)
    emit({"url": url, "text": txt})
finally:
    close_own()`);
  const j = json as { text: string };
  const t = j.text.replace(/\s*\|\s*/g, " ").replace(/\n+/g, "\n").trim();
  if (!t) throw new LiveError("Could not read Enrollment Dates (session expired?). Sign in to SIS in Chrome and retry.");
  return t;
}

export async function readPlannerText(): Promise<string> {
  const { json } = await runPy(`${SIS_PROLOGUE}
try:
    tid2, sid2 = open_window(${JSON.stringify(SIS_PSP + "WEBLIB_HCX_EN.H_PLANNER.FieldFormula.IScript_Main")})
    try:
        txt = ""
        for _ in range(25):
            txt = frame_text(sid2)
            if "COURSE" in txt: break
            time.sleep(1)
    finally:
        close(tid2)
    emit({"url": url, "text": txt})
finally:
    close_own()`);
  return (json as { text: string }).text;
}

/** Shapes documented in docs/live-endpoints.md. Units can arrive as numbers or strings ("3.00"). */
export interface TranscriptEnrollment {
  subject: string; catalog_nbr: string; class_nbr?: string; descr: string;
  units_attempted: number | string; units_earned: number | string; grade: string; crse_topic?: string;
}
export interface TranscriptTest { course: string; course_title: string; attempted: number | string; earned: number | string; grade: string }
export interface TranscriptJson {
  terms: Array<{ strm: string; descr: string }>;
  enrollments: Record<string, { enrollments: TranscriptEnrollment[] }>;
  test: { test_credit?: { programs?: Array<{ terms?: Array<{ strm: string; descr: string; tests?: TranscriptTest[] }> }> } };
  transfer: unknown;
  programs: { terms?: Array<{ programs?: Array<{ acad_prog_descr: string; plans?: Array<{ acad_plan_descr: string }> }> }> };
  scores: unknown;
}

/** Build a Profile straight from the unofficial-transcript JSON (no text parsing). */
export async function readTranscriptProfile(): Promise<{ profile: Profile; raw: TranscriptJson }> {
  const { json } = await runPy(`${SIS_PROLOGUE}
try:
    Q = "institution=UVA01&transcript_type=UNADV&acad_career=UGRD"
    terms = sis("${TRANSCR}IScript_EnrollmentTerms?" + Q)
    enr = {}
    for t in (terms.get("enrollment_terms") or []):
        enr[t["strm"]] = sis("${TRANSCR}IScript_Enrollment?" + Q + "&strm=" + t["strm"])
    test = sis("${TRANSCR}IScript_TestCredit?" + Q)
    transfer = sis("${TRANSCR}IScript_TransferCredit?" + Q)
    programs = sis("${TRANSCR}IScript_Programs?" + Q)
    scores = sis("${TRANSCR}IScript_TestScores?institution=UVA01&transcript_type=UNADV")
    emit({"url": url, "terms": terms.get("enrollment_terms") or [], "enrollments": enr, "test": test, "transfer": transfer, "programs": programs, "scores": scores, "raw_terms": terms})
finally:
    close_own()`);
  const j = json as TranscriptJson & { raw_terms: { __raw?: string } };
  signedInGuard(j.raw_terms);
  return { profile: buildTranscriptProfile(j), raw: j };
}

/** Subjects whose placement rows ("SPAN 3010P") can satisfy World Language; a level above 2020 exempts. */
const LANGUAGE_SUBJECTS = new Set(["SPAN", "FREN", "GERM", "ITAL", "PORT", "CHIN", "JAPN", "KOR", "RUSS", "ARAB", "HEBR", "LATI", "GREE", "HIND", "URDU", "PERS", "TURK", "SWAH", "ASL"]);

const num = (v: unknown): number => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; };

interface Candidate { row: ProfileCourse; key: string; strm: number }

/** Pure: transcript JSON → Profile. `now` decides which terms are past (grades expected). */
export function buildTranscriptProfile(j: TranscriptJson, now = new Date()): Profile {
  const cands: Candidate[] = [];
  const notes = ["Built from the SIS unofficial transcript (live)."];
  for (const t of j.terms ?? []) {
    const termName = sisTermName(t.descr);
    const past = termIsPast(termName, now);
    let ungraded = 0;
    for (const e of j.enrollments?.[t.strm]?.enrollments ?? []) {
      const grade = e.grade?.trim() || undefined;
      const attempted = num(e.units_attempted), earned = num(e.units_earned);
      if (!grade && past) ungraded++;
      cands.push({
        key: `${e.subject} ${e.catalog_nbr}|${e.crse_topic?.trim() ?? ""}`, strm: num(t.strm),
        row: {
          course: `${e.subject} ${e.catalog_nbr}`, title: e.crse_topic ? `${e.descr}: ${e.crse_topic}` : e.descr,
          // completed rows count what SIS says was earned; an ungraded row has nothing earned yet, so show attempted
          credits: grade ? earned : (earned || attempted), grade,
          status: grade ? "completed" : "in_progress", term: termName, source: "sis-live",
        },
      });
    }
    if (ungraded) notes.push(`${termName}: grades not yet posted (${ungraded} row${ungraded === 1 ? "" : "s"} kept as in progress).`);
  }
  let worldLanguagePlacement = false;
  for (const p of j.test?.test_credit?.programs ?? []) for (const t of p.terms ?? []) for (const x of t.tests ?? []) {
    const placement = x.course.trim().match(/^([A-Z]+)\s*(\d{4})P$/);
    if (placement) {
      if (LANGUAGE_SUBJECTS.has(placement[1]) && parseInt(placement[2], 10) > 2020) worldLanguagePlacement = true;
      continue; // placement rows carry no credit and are not courses
    }
    cands.push({
      key: `${x.course.trim()}|`, strm: num(t.strm),
      row: { course: x.course.trim(), title: x.course_title, credits: num(x.earned) || num(x.attempted), grade: x.grade?.trim() || "TE", status: "test", term: sisTermName(t.descr), generic: /\d{4}T$/.test(x.course), source: "sis-live" },
    });
  }
  const tests: Profile["tests"] = [];
  // test scores: array of {test_id?, test_component?, descr?, score?} — keep whatever looks like an exam + score
  const walkScores = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walkScores); return; }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const name = String(o.descr ?? o.test_descr ?? o.component_descr ?? "");
      const score = o.score ?? o.test_score;
      if (name && score !== undefined && /AP|IB|SAT|ACT|Placement|Diagnostic/i.test(name)) tests.push({ exam: name.replace(/^AP - /, "AP "), score: String(score) });
      Object.values(o).forEach(walkScores);
    }
  };
  walkScores(j.scores);
  const prog = j.programs?.terms?.at(-1)?.programs?.[0];
  return {
    courses: dedupe(cands), tests, worldLanguagePlacement,
    program: prog ? `${prog.acad_prog_descr}${prog.plans?.[0] ? ` — ${prog.plans[0].acad_plan_descr}` : ""}` : undefined,
    pathway: "engagements", notes, parsedAt: now.toISOString(), sourceFormat: "sis-transcript",
  };
}

/** One row per course+topic: a retake keeps the passing attempt, else the ungraded one, else the latest term. */
function dedupe(cands: Candidate[]): ProfileCourse[] {
  const outcome = (r: ProfileCourse) => r.status === "test" || r.status === "transfer" ? 2 : !r.grade ? 1 : (isPassing(r.grade) || /^(CR|S|P|TE|T)$/i.test(r.grade)) ? 2 : 0;
  const m = new Map<string, Candidate>();
  for (const c of cands) {
    const p = m.get(c.key);
    if (!p || outcome(c.row) > outcome(p.row) || (outcome(c.row) === outcome(p.row) && c.strm > p.strm)) m.set(c.key, c);
  }
  return [...m.values()].map((c) => c.row).sort((a, b) => a.course.localeCompare(b.course) || (a.title ?? "").localeCompare(b.title ?? ""));
}

/** "2026 Fall" -> "Fall 2026" */
export function sisTermName(descr: string): string {
  const m = descr.match(/(\d{4})\s+(Fall|Spring|Summer|January)/);
  return m ? `${m[2]} ${m[1]}` : descr;
}
function termIsPast(term: string, now: Date): boolean {
  const m = term.match(/(Fall|Spring|Summer|January) (\d{4})/);
  if (!m) return false;
  const endMonth = { Fall: 12, Spring: 5, Summer: 8, January: 1 }[m[1]] ?? 12;
  return new Date(parseInt(m[2], 10), endMonth, 0) < now;
}

export function cartMeetings(c: CartClass): Meeting[] {
  return (c.meetings ?? []).map((m) => fromSisMeeting({ ...m, start_dt: m.start_dt, end_dt: m.end_dt }));
}
