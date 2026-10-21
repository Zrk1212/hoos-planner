/**
 * Requirements engine for the College of Arts & Sciences Engagements Pathway (2026-27 Record),
 * plus McIntire (B.S. Commerce, 3-year format) and School of Data Science (BSDS) prerequisites.
 * Rules and sources: docs/college-gen-ed-rules.md, docs/mcintire-admission.md, docs/sds-bsds-admission.md.
 *
 * Pure functions: profile (parsed audit) + attribute index (course -> SIS attrs) + planned sections -> status.
 */
import { cappedCredits, collegeStatus, departmentOf, eligibleForGenEd } from "./college";
import { creditKey } from "./sections";
import { ATTR, DISCIPLINE_CODES, DISCIPLINES, ENGAGEMENTS, type DisciplineCode, type EngagementNbr, type Profile, type ProfileCourse, type Section } from "./types";

export type ItemStatus = "done" | "in_progress" | "planned" | "missing";
export interface Item { status: ItemStatus; by?: string; note?: string }

export interface AttrIndex { [course: string]: string[] }
export interface AcadGroupIndex { [course: string]: string }

/**
 * Attributes for courses that may not be in the current term's catalog (fall-only, AP equivalents).
 * From docs/college-gen-ed-rules.md §2–3 (verified in SIS 2026-10-19).
 */
export const KNOWN_COURSE_ATTRS: AttrIndex = {
  "MATH 1210": ["ASUQ-QCD"], "MATH 1220": ["ASUQ-QCD"], "MATH 1310": ["ASUQ-QCD"], "MATH 1320": ["ASUQ-QCD"],
  "MATH 1160": ["ASUQ-QCD"], "MATH 1192": ["ASUQ-QCD"], "MATH 2310": ["ASUD-CMP"],
  "STAT 2120": ["ASUQ-QCD"], "STAT 1100": ["ASUQ-QCD"], "STAT 1601": ["ASUQ-QCD"], "STAT 2020": ["ASUQ-QCD"],
  "PSYC 2005": ["ASUQ-QCD"],
  "ECON 2010": ["ASUD-SES"], "ECON 2020": ["ASUD-SES"],
  "BIOL 2100": ["ASUD-LS"], "BIOL 2200": ["ASUD-LS"],
  "PHIL 1000": ["ASUD-AIP"], "PHIL 1330": ["ASUD-AIP", "ASUD-SS"], "PHIL 1410": ["ASUD-AIP"], "PHIL 1730": ["ASUD-AIP"],
  "PHIL 1740": ["ASUD-AIP", "ASUD-SS"], "PHIL 2060": ["ASUD-AIP", "ASUD-SES"], "PHIL 2120": ["ASUD-AIP", "ASUD-HP"],
  "PSYC 1010": ["ASUD-LS", "ASUD-SES"], "PSYC 2150": ["ASUD-LS"], "PSYC 2200": ["ASUD-LS"], "PSYC 2600": ["ASUD-SES", "ASUD-SS"], "PSYC 2700": ["ASUD-LS", "ASUD-SES"],
  "SOC 1010": ["ASUD-SES"], "ANTH 1010": ["ASUD-LS", "ASUD-SES"],
  "HIUS 2001": ["ASUD-HP"], "HIUS 2051": ["ASUD-HP", "ASUD-SES"], "HIEU 2041": ["ASUD-HP", "ASUD-SES"], "HIEU 2102": ["ASUD-CSW", "ASUD-HP"],
  "HIST 1501": ["ASUD-HP", "ASUR-R21C2"],
  "RELG 1010": ["ASUD-CSW", "ASUD-HP"], "RELG 1000": ["ASUD-AIP", "ASUD-CSW"], "RELG 1040": ["ASUD-CSW", "ASUD-HP"], "RELG 2210": ["ASUD-AIP", "ASUD-SS", "ASUR-R21C2"],
  "MUSI 1310": ["ASUD-AIP"], "MUSI 1410": ["ASUD-AIP"], "MUSI 2072": ["ASUD-AIP", "ASUD-HP", "ASUR-R21C2"],
  "DRAM 1010": ["ASUD-AIP"], "DRAM 1020": ["ASUD-AIP"], "DRAM 2020": ["ASUD-AIP"],
  "ARTH 2000": ["ASUD-AIP", "ASUD-CSW"], "ARTH 1861": ["ASUD-AIP", "ASUD-CSW"], "ARTH 2052": ["ASUD-AIP", "ASUD-HP"], "ARTH 2054": ["ASUD-AIP", "ASUD-HP"], "ARTH 2745": ["ASUD-AIP", "ASUD-HP"],
  "ARTS 2000": ["ASUD-AIP"], "ARTS 2610": ["ASUD-AIP"],
  "ENWR 1505": ["ASUR-R21C1"], "ENWR 1506": ["ASUR-R21C1"], "ENWR 1507": ["ASUR-R21C1"], "ENWR 1508": ["ASUR-R21C1"],
  "ENWR 1510": ["ASUR-R21C1"], "ENWR 1520": ["ASUR-R21C1"], "ENWR 1530": ["ASUR-R21C1"], "ENWR 2510": ["ASUR-R21C1"], "ENWR 2520": ["ASUR-R21C1"],
};

/** Two-semester First Writing stretch sequences: both halves are needed (docs/college-gen-ed-rules.md §2). */
const FWR_STRETCH: Array<[string, string]> = [["ENWR 1505", "ENWR 1506"], ["ENWR 1507", "ENWR 1508"]];
const FWR_STRETCH_COURSES = new Set(FWR_STRETCH.flat());

const LETTER_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
const gradeRank = (g?: string) => (g ? LETTER_GRADES.indexOf(g.toUpperCase()) : -1);
export function isLetterGrade(g?: string): boolean { return gradeRank(g) >= 0; }
export function gradeAtLeast(g: string | undefined, min: string): boolean {
  const r = gradeRank(g); return r >= 0 && r <= LETTER_GRADES.indexOf(min);
}
export function isPassing(g?: string): boolean {
  const r = gradeRank(g); return r >= 0 && r < LETTER_GRADES.indexOf("F");
}
/** Grades that are not a graded basis: CR/NC, S/U (Satisfactory/Unsatisfactory), P, audit, withdrawal. */
const CRNC = new Set(["CR", "NC", "S", "U", "P", "AU", "W", "WD"]);
/** Non-graded results that still earn the credit. */
const CRNC_EARNING = new Set(["CR", "S", "P"]);

/** Is a SIS grading basis a Credit/No Credit or Satisfactory/Unsatisfactory basis (no letter grade)? */
export function isCrNcBasis(basis?: string | null): boolean {
  return !!basis && /credit\s*\/\s*no\s*credit|satisfactory\s*\/\s*unsatisfactory|\bS\s*\/\s*U\b|\bCR\s*\/\s*NC\b|pass\s*\/\s*fail|\bP\s*\/\s*F\b/i.test(basis);
}

/**
 * Credits a cart section counts for. Variable-unit sections ("1 - 12") count at `units_min` and are flagged so
 * callers can say "variable units"; an empty or unparsable `units` string gives 0, never NaN.
 */
export function sectionCredits(s: Pick<Section, "units" | "units_min" | "units_max">): { credits: number; variable: boolean } {
  const num = (x: number | string | null | undefined): number | null => {
    if (x == null) return null;
    const n = typeof x === "number" ? x : parseFloat(String(x).trim());
    return Number.isFinite(n) ? n : null;
  };
  const text = (s.units ?? "").trim();
  const range = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  const lo = num(s.units_min) ?? (range ? num(range[1]) : num(text));
  const hi = num(s.units_max) ?? (range ? num(range[2]) : lo);
  const credits = lo ?? hi ?? 0;
  return { credits, variable: lo != null && hi != null && hi > lo };
}

/** A course row is "earned" (completed/transfer/test with a non-failing result). */
function earned(c: ProfileCourse): boolean {
  if (c.status === "completed") return !c.grade || isPassing(c.grade) || CRNC_EARNING.has(c.grade.toUpperCase());
  return c.status === "transfer" || c.status === "test";
}
function counting(c: ProfileCourse): boolean { return earned(c) || c.status === "in_progress" || c.status === "planned"; }
/** graded basis (not CR/NC or S/U) — unknown grade while in progress is assumed graded */
function gradedBasis(c: ProfileCourse): boolean {
  if (!c.grade) return true;
  return !CRNC.has(c.grade.toUpperCase());
}
function statusOf(c: ProfileCourse): ItemStatus {
  if (c.status === "in_progress") return "in_progress";
  if (c.status === "planned") return "planned";
  return earned(c) ? "done" : "missing";
}
const RANK: Record<ItemStatus, number> = { done: 0, in_progress: 1, planned: 2, missing: 3 };
function best(items: Array<{ c: ProfileCourse; item: Item }>): Item {
  if (!items.length) return { status: "missing" };
  items.sort((a, b) => RANK[a.item.status] - RANK[b.item.status]);
  return items[0].item;
}
/** One row per course, keeping the best-status row (so duplicates never double-count). */
function uniqueByCourse(rows: ProfileCourse[]): ProfileCourse[] {
  const m = new Map<string, ProfileCourse>();
  for (const c of rows) { const p = m.get(c.course); if (!p || RANK[statusOf(c)] < RANK[statusOf(p)]) m.set(c.course, c); }
  return [...m.values()];
}

export interface EngagementStatus { nbr: EngagementNbr; name: string; item: Item }
export interface DisciplineStatus { code: DisciplineCode; name: string; item: Item; department?: string }

export interface RequirementStatus {
  engagements: { areas: EngagementStatus[]; remaining: EngagementNbr[]; perSemesterCap: number; warnings: string[] };
  literacies: {
    fwr: Item; swr: Item; worldLanguage: Item;
    qcd: { courses: Array<{ course: string; status: ItemStatus }>; needed: number; item: Item };
  };
  disciplines: {
    areas: DisciplineStatus[]; unmet: DisciplineCode[]; departments: string[]; departmentsNeeded: number;
    alternatives: Record<string, DisciplineCode[]>; warnings: string[];
  };
  credits: {
    earned: number; inProgress: number; planned: number; projected: number;
    test: number; college: number; nonCollege: number; nonCollegeMax: number;
    uvaGraded: number; uvaGradedProjected: number; uvaCreditsProjected: number;
  };
  mcintire: { comm1800: Item; econ2010: Item; fwr: Item; gradedUvaCredits: { have: number; projected: number; need: number }; ready: boolean; notes: string[] };
  sds: { ds1001: Item; programming: Item; uvaCredits: { have: number; projected: number; need: number }; ready: boolean; notes: string[] };
  warnings: string[];
}

export interface EvaluateInput {
  profile: Profile;
  /** term catalog attributes, merged over KNOWN_COURSE_ATTRS */
  attrIndex?: AttrIndex;
  acadGroups?: AcadGroupIndex;
  /** sections in the cart (treated as planned) */
  planned?: Section[];
  plannedTermName?: string;
}

/** A row's own section attributes win over the merged course index (sections of one course can differ). */
function attrsFor(c: ProfileCourse, idx: AttrIndex): string[] {
  return c.attrs ?? idx[c.course] ?? KNOWN_COURSE_ATTRS[c.course] ?? [];
}

function plannedToCourses(planned: Section[], termName?: string): { courses: ProfileCourse[]; notes: string[] } {
  const seen = new Map<string, ProfileCourse>();
  const notes: string[] = [];
  for (const s of planned) {
    const { credits, variable } = sectionCredits(s);
    if (variable) notes.push(`${s.course} #${s.class_nbr} has variable units (${s.units ?? `${s.units_min}-${s.units_max}`}); counted at ${credits}.`);
    const key = creditKey(s);
    const prev = seen.get(key);
    const attrs = [...new Set([...(prev?.attrs ?? []), ...(s.attrs ?? [])])];
    const pc: ProfileCourse = {
      course: s.course, title: s.descr ?? undefined, credits: Math.max(credits, prev?.credits ?? 0),
      status: "planned", term: termName, source: "cart",
      grade: isCrNcBasis(s.grading_basis) ? "CR" : prev?.grade,
      attrs,
    };
    seen.set(key, pc);
  }
  return { courses: [...seen.values()], notes };
}

/**
 * Maximum bipartite matching courses -> discipline categories (one category per course), in status order:
 * every done course is matched before any in-progress course is considered, and in-progress before planned.
 * Augmenting paths may move an earlier course to another of its categories but never unmatch it, so the
 * done courses keep a maximum matching among themselves.
 */
function assignDisciplines(courses: Array<{ c: ProfileCourse; cats: DisciplineCode[] }>): Map<DisciplineCode, ProfileCourse> {
  const order = [...courses].sort((a, b) => RANK[statusOf(a.c)] - RANK[statusOf(b.c)] || a.cats.length - b.cats.length);
  const matchCat = new Map<DisciplineCode, number>(); // category -> index in order
  const tryAssign = (i: number, seen: Set<DisciplineCode>): boolean => {
    for (const cat of order[i].cats) {
      if (seen.has(cat)) continue;
      seen.add(cat);
      const holder = matchCat.get(cat);
      if (holder === undefined || tryAssign(holder, seen)) { matchCat.set(cat, i); return true; }
    }
    return false;
  };
  for (const pass of ["done", "in_progress", "planned", "missing"] as ItemStatus[]) {
    for (let i = 0; i < order.length; i++) if (statusOf(order[i].c) === pass) tryAssign(i, new Set());
  }
  const out = new Map<DisciplineCode, ProfileCourse>();
  for (const [cat, i] of matchCat) out.set(cat, order[i].c);
  return out;
}

export function evaluate(input: EvaluateInput): RequirementStatus {
  const idx: AttrIndex = { ...KNOWN_COURSE_ATTRS, ...(input.attrIndex ?? {}) };
  const groups = input.acadGroups ?? {};
  const plannedInput = input.planned ?? [];
  const { courses: plannedCourses, notes: plannedNotes } = plannedToCourses(plannedInput, input.plannedTermName);
  const profileCourses = input.profile.courses.filter((c) => c.status !== "planned");
  const all = [...profileCourses, ...plannedCourses];
  const warnings: string[] = [...plannedNotes];

  const find = (course: string) => all.filter((c) => c.course === course);
  const itemFor = (course: string, extra?: (c: ProfileCourse) => string | undefined): Item =>
    best(find(course).filter(counting).map((c) => ({ c, item: { status: statusOf(c), by: `${c.course}${c.term ? ` (${c.term})` : ""}`, note: extra?.(c) } })));
  /** Like itemFor, but a row taken CR/NC or S/U does not satisfy (McIntire prerequisites need a graded basis). */
  const gradedItemFor = (course: string): Item => {
    const rows = find(course).filter(counting);
    const graded = rows.filter(gradedBasis);
    if (graded.length) return best(graded.map((c) => ({ c, item: { status: statusOf(c), by: `${c.course}${c.term ? ` (${c.term})` : ""}` } })));
    if (rows.length) return { status: "missing", by: rows[0].course, note: `${course} is on a CR/NC or S/U basis; McIntire requires a letter grade.` };
    return { status: "missing" };
  };

  // ---- Engagements
  const areas: EngagementStatus[] = (Object.keys(ENGAGEMENTS) as EngagementNbr[]).map((nbr) => ({
    nbr, name: ENGAGEMENTS[nbr], item: itemFor(`EGMT ${nbr}`),
  }));
  const remaining = areas.filter((a) => a.item.status === "missing").map((a) => a.nbr);
  const egWarnings: string[] = [];
  const egPlanned = plannedCourses.filter((c) => c.course.startsWith("EGMT "));
  if (egPlanned.length > 2) egWarnings.push(`The College caps Engagements at 2 per semester; your cart has ${egPlanned.length}.`);
  for (const a of areas) {
    const dup = all.filter((c) => c.course === `EGMT ${a.nbr}` && counting(c));
    if (dup.length > 1 && dup.some((c) => c.status === "planned") && dup.some((c) => c.status !== "planned")) {
      egWarnings.push(`EGMT ${a.nbr} is already ${dup.find((c) => c.status !== "planned")!.status.replace("_", " ")}; the planned section is redundant.`);
    }
  }
  // spares: count cart SECTIONS per area (plannedCourses is already one row per course)
  const egSections = new Map<string, number>();
  for (const s of plannedInput) if (/^EGMT 15[1-4]0$/.test(s.course)) egSections.set(s.course, (egSections.get(s.course) ?? 0) + 1);
  for (const [course, n] of egSections) if (n > 1) egWarnings.push(`${n} sections of ${course} in the cart: you only enroll in one section of each Engagement area; the other ${n - 1} ${n - 1 === 1 ? "is a spare" : "are spares"}.`);

  // ---- Literacies
  const genEdCourses = all.filter((c) => counting(c) && !c.generic);
  const hasAttr = (c: ProfileCourse, attr: string) => attrsFor(c, idx).includes(attr);
  const uvaOrTest = (c: ProfileCourse) => c.status !== "transfer" || true; // transfer "equivalent" credit may satisfy FWR/QCD/Disciplines; see Record

  // First Writing: graded basis; a stretch sequence (1505+1506 / 1507+1508) needs both halves
  const fwrRows = genEdCourses.filter((c) => (hasAttr(c, ATTR.FWR) || /^ENWR (15\d\d|25[12]0)$/.test(c.course)) && gradedBasis(c) && uvaOrTest(c));
  const fwrCandidates: Array<{ item: Item; used: string[] }> = [];
  for (const c of fwrRows) if (!FWR_STRETCH_COURSES.has(c.course)) fwrCandidates.push({ item: { status: statusOf(c), by: c.course }, used: [c.course] });
  for (const [a, b] of FWR_STRETCH) {
    const half = (course: string) => best(fwrRows.filter((c) => c.course === course).map((c) => ({ c, item: { status: statusOf(c), by: c.course } })));
    const ra = half(a), rb = half(b);
    if (ra.status === "missing" && rb.status === "missing") continue;
    if (ra.status !== "missing" && rb.status !== "missing") {
      const worse = RANK[ra.status] >= RANK[rb.status] ? ra.status : rb.status;
      fwrCandidates.push({ item: { status: worse, by: `${a} + ${b}` }, used: [a, b] });
    } else {
      const have = ra.status !== "missing" ? a : b;
      const need = ra.status !== "missing" ? b : a;
      const st = ra.status !== "missing" ? ra.status : rb.status;
      fwrCandidates.push({ item: { status: st === "done" ? "in_progress" : st, by: have, note: `${a}/${b} is a two-semester stretch sequence; ${need} is still needed.` }, used: [have] });
    }
  }
  fwrCandidates.sort((x, y) => RANK[x.item.status] - RANK[y.item.status]);
  const fwr: Item = fwrCandidates[0]?.item ?? { status: "missing" };
  /** only the course(s) actually used for FWR are barred from the Disciplines */
  const fwrUsed = new Set(fwrCandidates[0]?.used ?? []);

  const swrRows = genEdCourses.filter((c) => hasAttr(c, ATTR.SWR) && c.status !== "transfer" && c.status !== "test" && gradedBasis(c) && eligibleForGenEd(c.course, groups[c.course]));
  const swr = best(swrRows.map((c) => ({ c, item: { status: (c.status === "completed" && c.grade && !gradeAtLeast(c.grade, "C-")) ? "missing" as ItemStatus : statusOf(c), by: c.course, note: "C- or better; may double-count with a Discipline" } })));

  const langRows = genEdCourses.filter((c) => hasAttr(c, ATTR.WL) || /^[A-Z]{2,4} (20[2-9]\d|3\d{3}|4\d{3})[A-Z]?$/.test(c.course) && /^(SPAN|FREN|GERM|ITAL|PORT|CHIN|JAPN|KOR|RUSS|ARAB|HEBR|PERS|LATI|GREE|HIND|URDU|TURK|SANS|SWAH|ASL|TBTN|POL|CZ|UKR) /.test(c.course));
  let worldLanguage: Item = { status: "missing", note: "Four semesters of one language (through 2020), placement above 2020, or exemption" };
  if (input.profile.worldLanguagePlacement) worldLanguage = { status: "done", by: "placement / exemption" };
  else if (langRows.length) {
    const hi = langRows.sort((a, b) => parseInt(b.course.split(" ")[1]) - parseInt(a.course.split(" ")[1]))[0];
    const n = parseInt(hi.course.split(" ")[1], 10);
    worldLanguage = n >= 2020 ? { status: statusOf(hi), by: hi.course } : { status: "missing", by: hi.course, note: `Highest language course seen: ${hi.course}; need through 2020` };
  }

  const qcdRows = genEdCourses.filter((c) => hasAttr(c, ATTR.QCD) && gradedBasis(c));
  const qcdSeen = new Map<string, ItemStatus>();
  for (const c of qcdRows) { const s = statusOf(c); const p = qcdSeen.get(c.course); if (!p || RANK[s] < RANK[p]) qcdSeen.set(c.course, s); }
  const qcdCourses = [...qcdSeen.entries()].map(([course, status]) => ({ course, status })).sort((a, b) => RANK[a.status] - RANK[b.status]);
  const qcdDone = qcdCourses.filter((q) => q.status === "done").length;
  const qcdItem: Item = qcdDone >= 2 ? { status: "done", by: qcdCourses.map((q) => q.course).join(", ") }
    : qcdCourses.length >= 2 ? { status: qcdCourses[1].status, by: qcdCourses.map((q) => q.course).join(", ") }
    : { status: "missing", by: qcdCourses.map((q) => q.course).join(", ") || undefined, note: `${qcdCourses.length} of 2 QCD courses (6 credits). COMM 2004 (McIntire) or DS 2026 (SDS) later supplies 3 credits.` };

  // ---- Disciplines (one category per course, ≥3 credits, graded, ≥6 departments)
  const discCandidates = genEdCourses
    .filter((c) => c.credits >= 3 && gradedBasis(c) && !fwrUsed.has(c.course) && eligibleForGenEd(c.course, groups[c.course]))
    .map((c) => ({ c, cats: DISCIPLINE_CODES.filter((d) => hasAttr(c, ATTR.discipline(d))) }))
    .filter((x) => x.cats.length > 0);
  // one row per course (best status)
  const byCourse = new Map<string, { c: ProfileCourse; cats: DisciplineCode[] }>();
  for (const x of discCandidates) { const p = byCourse.get(x.c.course); if (!p || RANK[statusOf(x.c)] < RANK[statusOf(p.c)]) byCourse.set(x.c.course, x); }
  const assigned = assignDisciplines([...byCourse.values()]);
  const discAreas: DisciplineStatus[] = DISCIPLINE_CODES.map((code) => {
    const c = assigned.get(code);
    return c ? { code, name: DISCIPLINES[code], item: { status: statusOf(c), by: c.course }, department: departmentOf(c.course) }
      : { code, name: DISCIPLINES[code], item: { status: "missing" } };
  });
  const unmet = discAreas.filter((a) => a.item.status === "missing").map((a) => a.code);
  const departments = [...new Set(discAreas.filter((a) => a.department).map((a) => a.department!))];
  const alternatives: Record<string, DisciplineCode[]> = {};
  for (const x of byCourse.values()) if (x.cats.length > 1) alternatives[x.c.course] = x.cats;
  const discWarnings: string[] = [];
  if (unmet.length === 0 && departments.length < 6) discWarnings.push(`Disciplines must come from at least 6 departments; current plan uses ${departments.length}.`);
  const deptCount = new Map<string, number>();
  for (const a of discAreas) if (a.department) deptCount.set(a.department, (deptCount.get(a.department) ?? 0) + 1);
  for (const [d, n] of deptCount) if (n > 2) discWarnings.push(`${n} Disciplines from ${d}: only one department may supply two.`);

  // ---- Credits (each course counted once across earned / in progress / cart; KLPA/KINE capped at 2)
  const sum = (rows: ProfileCourse[]) => cappedCredits(rows);
  const earnedRows = uniqueByCourse(profileCourses.filter(earned));
  const earnedSet = new Set(earnedRows.map((c) => c.course));
  const ipRows = uniqueByCourse(profileCourses.filter((c) => c.status === "in_progress" && !earnedSet.has(c.course)));
  const ipSet = new Set(ipRows.map((c) => c.course));
  const plannedRows = plannedCourses.filter((c) => !earnedSet.has(c.course) && !ipSet.has(c.course));
  for (const c of plannedCourses) {
    if (earnedSet.has(c.course)) warnings.push(`${c.course} is already earned; its cart credits are not counted again.`);
    else if (ipSet.has(c.course)) warnings.push(`${c.course} is already in progress; its cart credits are not counted again.`);
  }
  const testRows = earnedRows.filter((c) => c.status === "test" || c.status === "transfer");
  const isCollege = (c: ProfileCourse) => c.status === "test" || c.status === "transfer" || collegeStatus(c.course, groups[c.course]) !== "non-college";
  const countingRows = [...earnedRows, ...ipRows, ...plannedRows];
  const college = sum(countingRows.filter(isCollege));
  const nonCollege = sum(countingRows.filter((c) => !isCollege(c)));
  const uvaRows = (rows: ProfileCourse[]) => rows.filter((c) => c.status !== "test" && c.status !== "transfer");
  const uvaGraded = sum(uvaRows(earnedRows).filter(gradedBasis));
  const uvaGradedProjected = uvaGraded + sum(uvaRows([...ipRows, ...plannedRows]).filter(gradedBasis));
  const uvaCreditsProjected = sum(uvaRows(countingRows));
  const credits = {
    earned: sum(earnedRows), inProgress: sum(ipRows), planned: sum(plannedCourses), projected: sum(countingRows),
    test: sum(testRows), college, nonCollege, nonCollegeMax: 12, uvaGraded, uvaGradedProjected, uvaCreditsProjected,
  };
  if (nonCollege > 12) warnings.push(`${nonCollege} non-College credits (max 12 count toward a College BA; moot if you enter McIntire or SDS).`);
  const plannedTotal = credits.planned;
  if (plannedCourses.length && plannedTotal < 12) warnings.push(`Cart totals ${plannedTotal} credits; 12 is the full-time minimum.`);
  if (plannedTotal > 18) warnings.push(`Cart totals ${plannedTotal} credits; more than 18 needs the dean's permission.`);

  // ---- McIntire (all three prerequisites on a graded basis; docs/mcintire-admission.md §5)
  const comm1800 = gradedItemFor("COMM 1800");
  const econ2010 = gradedItemFor("ECON 2010");
  const mcNotes: string[] = [];
  if (econ2010.status === "missing" && itemFor("ECON 2020").status !== "missing") mcNotes.push("ECON 2020 does not substitute for ECON 2010 (the Record names ECON 2010).");
  const mcReady = [comm1800, econ2010, fwr].every((i) => i.status !== "missing") && uvaGradedProjected >= 24;
  mcNotes.push("Prerequisites may be in progress at the May 4 deadline; 24 graded UVA credits are needed before entering (AP/transfer do not count).");
  const mcintire = { comm1800, econ2010, fwr, gradedUvaCredits: { have: uvaGraded, projected: uvaGradedProjected, need: 24 }, ready: mcReady, notes: mcNotes };

  // ---- SDS
  const ds1001Rows = find("DS 1001").filter((c) => counting(c) && c.status !== "transfer" && c.status !== "test");
  const ds1001 = best(ds1001Rows.map((c) => ({ c, item: {
    status: (c.status === "completed" && (!gradedBasis(c) || (c.grade && !gradeAtLeast(c.grade, "C-")))) ? "missing" as ItemStatus : statusOf(c),
    by: c.course, note: "Taken at UVA, letter grade C- or better (no CR/NC)",
  } })));
  const progCourses = ["DS 1002", "CS 1110", "CS 1111", "CS 1112", "CS 1113", "PHYS 1655"];
  const progRows = all.filter((c) => progCourses.includes(c.course) && counting(c) && gradedBasis(c));
  let programming = best(progRows.map((c) => ({ c, item: { status: statusOf(c), by: c.course } })));
  const apcsa = input.profile.tests.find((t) => /computer science a\b/i.test(t.exam) && !/principles/i.test(t.exam) && parseInt(t.score, 10) >= 4);
  // IB counts only at Higher Level (5–7); Standard Level does not meet the programming requirement
  const ibcs = input.profile.tests.find((t) => /\bib\b/i.test(t.exam) && /computer science/i.test(t.exam) && /\bHL\b/i.test(t.exam) && !/\bSL\b/i.test(t.exam) && parseInt(t.score, 10) >= 5);
  if (programming.status === "missing" && (apcsa || ibcs)) programming = { status: "done", by: `${(apcsa ?? ibcs)!.exam} ${(apcsa ?? ibcs)!.score}` };
  const sdsNotes: string[] = [];
  if (input.profile.tests.some((t) => /computer science principles/i.test(t.exam))) sdsNotes.push("AP CS Principles does not meet the programming requirement (only AP CS A 4/5 does).");
  if (input.profile.tests.some((t) => /\bib\b/i.test(t.exam) && /computer science/i.test(t.exam) && /\bSL\b/i.test(t.exam))) sdsNotes.push("IB Computer Science SL does not meet the programming requirement (only HL 5–7 does).");
  const cs111x = all.some((c) => /^CS 111[0-3]$|^CS 1120$|^PHYS 1655$/.test(c.course) && counting(c));
  if (cs111x && find("DS 1002").some(counting)) sdsNotes.push("DS 1002 cannot be taken after CS 1110-1113/1120 or PHYS 1655; pick one.");
  sdsNotes.push("Apply spring of first year only (Jan 27 – May 4); both prerequisites may be in progress at the deadline.");
  const sdsReady = ds1001.status !== "missing" && programming.status !== "missing" && uvaCreditsProjected >= 24;
  const sds = { ds1001, programming, uvaCredits: { have: sum(uvaRows(earnedRows)), projected: uvaCreditsProjected, need: 24 }, ready: sdsReady, notes: sdsNotes };

  return {
    engagements: { areas, remaining, perSemesterCap: 2, warnings: egWarnings },
    literacies: { fwr, swr, worldLanguage, qcd: { courses: qcdCourses, needed: 2, item: qcdItem } },
    disciplines: { areas: discAreas, unmet, departments, departmentsNeeded: 6, alternatives, warnings: discWarnings },
    credits, mcintire, sds, warnings,
  };
}

/** Labels for what a catalog section would satisfy given the current status (used by the builder and advisor). */
export function whatItSatisfies(section: Pick<Section, "course" | "attrs" | "acad_group" | "grading_basis" | "units" | "units_min" | "units_max">, status: RequirementStatus): string[] {
  const out: string[] = [];
  const egmt = section.course.match(/^EGMT (15[1-4]0)$/);
  if (egmt) {
    const nbr = egmt[1] as EngagementNbr;
    const a = status.engagements.areas.find((x) => x.nbr === nbr);
    out.push(`Engagement: ${ENGAGEMENTS[nbr]}${a && a.item.status !== "missing" ? ` (already ${a.item.status.replace("_", " ")})` : " (needed)"}`);
    return out;
  }
  if (!eligibleForGenEd(section.course, section.acad_group)) {
    if (collegeStatus(section.course, section.acad_group) === "non-college") out.push("non-College credit (no gen-ed)");
    else out.push("College-equivalent credit; no gen-ed attribute");
    if (isCrNcBasis(section.grading_basis)) out.push("CR/NC: no gen-ed credit");
    return out;
  }
  if (isCrNcBasis(section.grading_basis)) {
    out.push("CR/NC: no gen-ed credit");
    return out;
  }
  const { credits, variable } = sectionCredits(section);
  const disc = DISCIPLINE_CODES.filter((d) => section.attrs.includes(ATTR.discipline(d)));
  if (disc.length && credits >= 3) {
    const needed = disc.filter((d) => status.disciplines.unmet.includes(d));
    const label = disc.map((d) => `${d}${status.disciplines.unmet.includes(d) ? "" : " (done)"}`).join(" or ");
    out.push(`Discipline: ${label}${needed.length ? "" : " (already covered)"}`);
  } else if (disc.length && variable) {
    out.push(`Discipline: ${disc.join(" or ")} only if taken for 3+ credits (variable units)`);
  }
  if (section.attrs.includes(ATTR.SWR)) out.push(`Second Writing${status.literacies.swr.status === "missing" ? " (needed)" : " (already " + status.literacies.swr.status.replace("_", " ") + ")"}`);
  if (section.attrs.includes(ATTR.QCD)) out.push(`QCD${status.literacies.qcd.item.status === "done" ? " (done)" : ` (${status.literacies.qcd.courses.length} of 2 so far)`}`);
  if (section.attrs.includes(ATTR.WL)) out.push(`World Language${status.literacies.worldLanguage.status === "done" ? " (done)" : ""}`);
  if (section.attrs.includes(ATTR.FWR)) out.push("First Writing");
  if (!out.length) out.push("College credit; no gen-ed attribute");
  return out;
}

export function buildAttrIndex(sections: Array<Pick<Section, "course" | "attrs">>): AttrIndex {
  const idx: AttrIndex = {};
  for (const s of sections) {
    if (!s.attrs?.length) continue;
    const set = new Set([...(idx[s.course] ?? []), ...s.attrs]);
    idx[s.course] = [...set];
  }
  return idx;
}

export function buildAcadGroupIndex(sections: Array<Pick<Section, "course" | "acad_group">>): AcadGroupIndex {
  const idx: AcadGroupIndex = {};
  for (const s of sections) if (s.acad_group && !idx[s.course]) idx[s.course] = s.acad_group;
  return idx;
}
