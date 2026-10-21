/**
 * Pure section filtering/ranking shared by the builder UI and the advisor's search_sections tool.
 */
import { earliestStart, latestEnd, quarterOf, sectionDays, sectionsConflict } from "./meetings";
import { ratingFor, type RatingMap, type TermInfo } from "./catalog";
import { collegeStatus } from "./college";
import { isCrNcBasis, sectionCredits } from "./requirements";
import { creditKey, isSub } from "./sections";
export { creditKey, isSub };
import { ATTR, type DayCode, type DisciplineCode, type Rating, type Section } from "./types";

export interface SearchOptions {
  query?: string;            // free text: "DS 1002", "beatles", "pickleball", "14431"
  subject?: string;
  attrs?: string[];          // AIP|CMP|CSW|HP|LS|SS|SES|QCD|SWR|FWR|WL or raw ASUD-… codes
  engagement?: "1510" | "1520" | "1530" | "1540";
  quarter?: "A" | "B" | "full";   // A = first half (Q3 in spring), B = second half (Q4)
  days?: DayCode[];          // only sections whose meeting days are within this set (sections without days are dropped)
  earliestStart?: number;    // minutes after midnight, e.g. 660 = 11:00
  latestEnd?: number;
  maxDifficulty?: number;    // these three drop unrated sections unless includeUnrated is set
  minRating?: number;
  minGpa?: number;
  includeUnrated?: boolean;  // keep sections with no Course Forum data when a rating filter is set
  collegeOnly?: boolean;
  openOnly?: boolean;
  components?: string[];     // default: LEC, SEM, STO, WKS, IND… (exclude DIS/LAB unless asked)
  includeTba?: boolean;      // keep TBA-time sections when earliestStart/latestEnd is set
  avoidConflictsWith?: Section[];
  limit?: number;
  /** subjects in the catalog; a 2–4-letter query is a subject shortcut only when it is one of these (computed from `sections` when omitted) */
  subjects?: Set<string>;
}

export function normalizeAttr(a: string): string {
  const u = a.trim().toUpperCase();
  if (u.startsWith("ASU")) return u;
  if (u === "QCD") return ATTR.QCD;
  if (u === "SWR" || u === "R21C2" || u === "SECOND WRITING") return ATTR.SWR;
  if (u === "FWR" || u === "R21C1" || u === "FIRST WRITING") return ATTR.FWR;
  if (u === "WL" || u === "WORLD LANGUAGE") return ATTR.WL;
  if (["AIP", "CMP", "CSW", "HP", "LS", "SS", "SES"].includes(u)) return ATTR.discipline(u as DisciplineCode);
  return u;
}

export interface ScoredSection {
  section: Section;
  rating: Rating | null;
  ratingLevel: "instructor" | "course" | null;
  conflictsWith: string | null;
  quarter: "A" | "B" | "full" | "unknown";
}

const PRIMARY = new Set(["LEC", "SEM", "STO", "WKS", "IND", "PRA", "SPS", "CLN", "FLD"]);

export function searchSections(sections: Section[], ratings: RatingMap, term: TermInfo | null, opts: SearchOptions): ScoredSection[] {
  // "#14431" and "DS 1002-001" are how our own output prints sections; read them back the same way
  const q = (opts.query ?? "").trim().toLowerCase().replace(/^#(?=\d{5}$)/, "").replace(/^([a-z]{2,4}\s*\d{4}[a-z]?)-\d{3}$/, "$1").slice(0, 200);
  const words = [...new Set(q.split(/\s+/).filter(Boolean))].slice(0, 12);
  const attrs = (opts.attrs ?? []).map(normalizeAttr);
  const comps = opts.components ? new Set(opts.components.map((c) => c.toUpperCase())) : null;
  const nbr = /^\d{5}$/.test(q) ? parseInt(q, 10) : null;
  // "econ" / "ds 1002" is a subject shortcut only when the subject exists; otherwise it is ordinary text ("beat")
  let subjects = opts.subjects;
  const hasSubject = (subj: string) => {
    if (!subjects) subjects = new Set(sections.map((s) => s.subject));
    return subjects.has(subj);
  };
  const courseM = q.match(/^([a-z]{2,4})\s*(\d{4}[a-z]?)?$/);
  const courseQ = courseM && hasSubject(courseM[1].toUpperCase()) ? courseM : null;
  const timeFilter = opts.earliestStart != null || opts.latestEnd != null;

  const out: ScoredSection[] = [];
  for (const s of sections) {
    if (nbr != null) { if (s.class_nbr !== nbr) continue; }
    else {
      if (comps ? !comps.has(s.component ?? "") : !PRIMARY.has(s.component ?? "") || isSub(s)) continue;
      if (opts.subject && s.subject !== opts.subject.toUpperCase()) continue;
      if (opts.engagement) { if (s.course !== `EGMT ${opts.engagement}`) continue; }
      if (attrs.length && !attrs.every((a) => s.attrs.includes(a))) {
        // allow "any of the disciplines" semantics when several discipline codes are given
        const anyDisc = attrs.filter((a) => a.startsWith("ASUD-"));
        const nonDisc = attrs.filter((a) => !a.startsWith("ASUD-"));
        const okDisc = !anyDisc.length || anyDisc.some((a) => s.attrs.includes(a));
        const okOther = nonDisc.every((a) => s.attrs.includes(a));
        if (!(okDisc && okOther)) continue;
      }
      if (q && nbr == null) {
        if (courseQ) {
          const subj = courseQ[1].toUpperCase();
          if (s.subject !== subj) continue;
          if (courseQ[2] && !s.catalog_nbr.toLowerCase().startsWith(courseQ[2])) continue;
        } else {
          const hay = `${s.course} ${s.descr ?? ""} ${s.topic ?? ""} ${s.instructor_names ?? ""}`.toLowerCase();
          if (!words.every((w) => hay.includes(w))) continue;
        }
      }
      if (opts.collegeOnly && collegeStatus(s.course, s.acad_group) === "non-college") continue;
      if (opts.openOnly && s.enrl_stat !== "O") continue;
      const es = earliestStart(s);
      const le = latestEnd(s);
      // TBA-time sections are dropped only by a time filter (and kept with includeTba); a days filter needs days
      if (timeFilter && !opts.includeTba && (es == null || le == null)) continue;
      if (opts.earliestStart != null && es != null && es < opts.earliestStart) continue;
      if (opts.latestEnd != null && le != null && le > opts.latestEnd) continue;
      if (opts.days?.length) {
        const d = sectionDays(s);
        if (!d.length || !d.every((x) => opts.days!.includes(x))) continue;
      }
      const qtr = quarterOf(s, term);
      if (opts.quarter && qtr !== opts.quarter && !(opts.quarter === "full" && qtr === "unknown")) continue;
    }
    const { r, level } = ratingFor(ratings, s.course, s.instructor_names);
    // rating filters: an unrated section cannot be shown to pass, so it is dropped unless includeUnrated
    if (opts.maxDifficulty != null && (r?.difficulty == null ? !opts.includeUnrated : r.difficulty > opts.maxDifficulty)) continue;
    if (opts.minRating != null && (r?.rating == null ? !opts.includeUnrated : r.rating < opts.minRating)) continue;
    if (opts.minGpa != null && (r?.gpa == null ? !opts.includeUnrated : r.gpa < opts.minGpa)) continue;
    let conflictsWith: string | null = null;
    if (opts.avoidConflictsWith?.length) {
      for (const c of opts.avoidConflictsWith) {
        if (c.class_nbr === s.class_nbr) continue;
        const why = sectionsConflict(s, c);
        if (why) { conflictsWith = `${c.course} #${c.class_nbr}`; break; }
      }
      if (conflictsWith) continue;
    }
    out.push({ section: s, rating: r, ratingLevel: level, conflictsWith, quarter: quarterOf(s, term) });
  }
  out.sort(rankSections);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** Easier + better-rated + more open seats first; unknown ratings sink below known ones. */
export function rankSections(a: ScoredSection, b: ScoredSection): number {
  const da = a.rating?.difficulty ?? 9, db = b.rating?.difficulty ?? 9;
  if (da !== db) return da - db;
  const ra = a.rating?.rating ?? -1, rb = b.rating?.rating ?? -1;
  if (ra !== rb) return rb - ra;
  const ga = a.rating?.gpa ?? -1, gb = b.rating?.gpa ?? -1;
  if (ga !== gb) return gb - ga;
  return (b.section.enrollment_available ?? 0) - (a.section.enrollment_available ?? 0);
}

/** Smallest caps first, sections with reserve caps first — the order to add in SIS. (rqmnt_designtn is a
 *  requirement designation like NW/SW, not a restriction.) */
/**
 * Order to add sections in SIS: scarce seats first (reserve caps, then small capacity), closed sections last.
 * A course's discussion/lab rides right after its lecture, since SIS adds them as a pair.
 */
export function enrollOrder(cart: Section[]): Section[] {
  const isPrimary = (s: Section) => !isSub(s);
  const rank = (s: Section) => [s.enrl_stat === "C" ? 1 : 0, s.reserve_caps.length ? 0 : 1, s.class_capacity ?? 999];
  const cmp = (a: Section, b: Section) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  const subsOf = (l: Section) => (isPrimary(l) ? cart.filter((s) => !isPrimary(s) && s.course === l.course).sort(cmp) : []);
  // a lecture ranks by its scarcest piece: a 266-seat lecture with a 20-seat discussion goes early
  const groupRank = (l: Section) => [l, ...subsOf(l)].map(rank).reduce((a, b) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) <= 0 ? a : b);
  const leads = cart.filter((s) => isPrimary(s) || !cart.some((o) => o !== s && isPrimary(o) && o.course === s.course))
    .sort((a, b) => { const x = groupRank(a), y = groupRank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  return leads.flatMap((l) => [l, ...subsOf(l)]);
}

/**
 * Cart credit total plus notes for variable-unit sections ("1 - 12"), which count at their minimum.
 * Each course is counted once (lecture + lab share units); an empty `units` string counts 0, never NaN.
 */
export function cartCreditsDetail(cart: Section[]): { credits: number; notes: string[] } {
  const seen = new Map<string, number>();
  const notes: string[] = [];
  for (const s of cart) {
    const { credits, variable } = sectionCredits(s);
    if (variable) notes.push(`${s.course} #${s.class_nbr}: variable units (${s.units ?? `${s.units_min}-${s.units_max}`}), counted at ${credits}`);
    const k = creditKey(s);
    seen.set(k, Math.max(seen.get(k) ?? 0, credits));
  }
  return { credits: [...seen.values()].reduce((a, b) => a + b, 0), notes };
}

export function cartCredits(cart: Section[]): number {
  return cartCreditsDetail(cart).credits;
}

export function describeSection(x: ScoredSection, termInfo?: TermInfo | null): string {
  const s = x.section;
  const meet = s.meetings.map((m) => (m.days.length && m.start != null ? `${m.days.join("")} ${fmt(m.start)}-${fmt(m.end!)}` : "TBA")).join(" | ");
  const qtr = x.quarter === "A" ? " [first half]" : x.quarter === "B" ? " [second half]" : "";
  const r = x.rating ? ` CF ${x.rating.rating ?? "–"}/${x.rating.difficulty ?? "–"}/${x.rating.gpa ?? "–"}${x.ratingLevel === "course" ? " (course avg)" : ""}` : " CF none";
  const seats = `${s.enrollment_available ?? "?"}/${s.class_capacity ?? "?"} open`;
  const { variable } = sectionCredits(s);
  const flags = [s.reserve_caps.length ? "reserve caps" : "", s.rqmnt_designtn ? `old-curriculum code ${s.rqmnt_designtn} (doesn't affect students on the current curriculum)` : "", s.enrl_stat !== "O" ? s.enrl_stat : "", isCrNcBasis(s.grading_basis) ? "CR/NC" : "", variable ? "variable units" : ""].filter(Boolean).join(", ");
  void termInfo;
  return `#${s.class_nbr} ${s.course}-${s.class_section} ${s.descr}${s.topic ? ` (${s.topic})` : ""} — ${s.instructor_names ?? "TBA"}; ${meet}${qtr}; ${s.units} cr; attrs ${s.attrs.join(",") || "none"}; ${seats};${r}${flags ? `; ${flags}` : ""}`;
}

function fmt(min: number): string {
  const h24 = Math.floor(min / 60), m = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${m.toString().padStart(2, "0")}${h24 >= 12 ? "pm" : "am"}`;
}

const secNum = (s: Section) => parseInt(s.class_section ?? "", 10);
const hundred = (s: Section) => Math.floor(secNum(s) / 100) * 100;
const isHundredLead = (s: Section) => Number.isFinite(secNum(s)) && secNum(s) >= 100 && secNum(s) % 100 === 0;

/**
 * Discussion/lab sections that go with a lecture. UVA numbers them in the lecture's hundreds (lecture 200 →
 * discussions 201-299) when a course runs several lectures that way. Blocks owned by another lecture never
 * fit; a lecture with no block of its own takes the course's unowned sections (often none).
 */
export function companionSections(lecture: Section, all: Section[]): Section[] {
  const subs = all.filter((o) => o.course === lecture.course && isSub(o));
  if (!subs.length) return [];
  const leads = all.filter((o) => o.course === lecture.course && !isSub(o));
  const owned = new Set(leads.filter(isHundredLead).map(hundred).filter((h) => subs.some((x) => hundred(x) === h)));
  if (isHundredLead(lecture) && owned.has(hundred(lecture))) return subs.filter((x) => hundred(x) === hundred(lecture));
  return subs.filter((x) => !owned.has(hundred(x)));
}

/** Problems SIS would raise with lecture/discussion pairs in a set of sections, in plain words. */
export function companionProblems(chosen: Section[], all: Section[]): string[] {
  const out: string[] = [];
  const leads = chosen.filter((s) => !isSub(s));
  for (const key of new Set(leads.map(creditKey))) {
    const dup = leads.filter((s) => creditKey(s) === key);
    if (dup.length > 1) out.push(`${dup[0].course} is in the cart twice (${dup.map((d) => `#${d.class_nbr}`).join(", ")}); keep one section and make the other a backup`);
  }
  for (const sub of chosen.filter((s) => isSub(s) && !leads.some((l) => l.course === s.course))) {
    if (all.some((o) => o.course === sub.course && !isSub(o))) out.push(`#${sub.class_nbr} (${sub.course}-${sub.class_section}) is a ${sub.component === "LAB" ? "lab" : "discussion"}; add its lecture too`);
  }
  for (const lec of leads) {
    const fits = companionSections(lec, all);
    const picked = chosen.filter((s) => s.course === lec.course && isSub(s));
    if (!fits.length) {
      for (const p of picked) out.push(`#${p.class_nbr} (${p.course}-${p.class_section}) belongs to another lecture, and ${lec.course}-${lec.class_section} (#${lec.class_nbr}) doesn't go with it; drop it or switch to that lecture`);
      continue;
    }
    const kind = fits[0].component === "LAB" ? "lab" : fits[0].component === "DIS" ? "discussion" : "workshop";
    if (!picked.length) { out.push(`${lec.course}-${lec.class_section} (#${lec.class_nbr}) also needs a ${kind} section, e.g. #${fits.slice(0, 3).map((f) => f.class_nbr).join(", #")}`); continue; }
    const ok = new Set(fits.map((f) => f.class_nbr));
    for (const p of picked.filter((x) => !ok.has(x.class_nbr))) {
      out.push(`#${p.class_nbr} (${p.course}-${p.class_section}) doesn't go with lecture ${lec.course}-${lec.class_section} (#${lec.class_nbr}); pick one of its own sections, e.g. #${fits.slice(0, 3).map((f) => f.class_nbr).join(", #")}`);
    }
  }
  return out;
}
