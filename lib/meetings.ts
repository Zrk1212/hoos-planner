import type { DayCode, Meeting, Section } from "./types";

export const DAY_ORDER: DayCode[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export const DAY_LABEL: Record<DayCode, string> = {
  Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun",
};

/** "MoWeFr" -> ["Mo","We","Fr"]; "TBA" -> [] */
export function parseDays(s: string | null | undefined): DayCode[] {
  if (!s) return [];
  const out: DayCode[] = [];
  const re = /Mo|Tu|We|Th|Fr|Sa|Su/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[0] as DayCode);
  return out;
}

/** "14.00.00.000000" | "14.00" | "2:00PM" -> minutes after midnight */
export function parseTime(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[.:](\d{2})/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const pm = /pm/i.test(t);
    const am = /am/i.test(t);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    return h * 60 + min;
  }
  m = t.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    if (/pm/i.test(m[2]) && h < 12) h += 12;
    if (/am/i.test(m[2]) && h === 12) h = 0;
    return h * 60;
  }
  return null;
}

/** "01/20/2027" -> "2027-01-20" */
export function toIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function fmtTime(min: number | null): string {
  if (min == null) return "TBA";
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${m.toString().padStart(2, "0")}${ampm}`;
}

export function fmtMeeting(m: Meeting): string {
  if (!m.days.length || m.start == null) return "TBA";
  return `${m.days.join("")} ${fmtTime(m.start)}–${fmtTime(m.end)}`;
}

export function fmtMeetings(ms: Meeting[]): string {
  if (!ms.length) return "TBA";
  return ms.map(fmtMeeting).join(" | ");
}

/** Raw SIS meeting object -> normalized Meeting */
export function fromSisMeeting(raw: {
  days?: string; start_time?: string; end_time?: string; start_dt?: string; end_dt?: string;
  facility_descr?: string; instructor?: string;
}): Meeting {
  const days = parseDays(raw.days);
  return {
    days,
    start: days.length ? parseTime(raw.start_time) : null,
    end: days.length ? parseTime(raw.end_time) : null,
    start_dt: toIsoDate(raw.start_dt),
    end_dt: toIsoDate(raw.end_dt),
    facility: raw.facility_descr && raw.facility_descr !== "***" ? raw.facility_descr : null,
    instructor: raw.instructor ? raw.instructor.replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim() : null,
  };
}

/**
 * Seed-format meeting string, e.g. "MoWe 14.00-15.15 ***" or
 * "Th 14.00-15.15 *** | MoWeFr 12.00-12.50 ***" or "TBA - ***".
 */
export function fromSeedMeet(meet: string, start_dt: string | null, end_dt: string | null): Meeting[] {
  if (!meet || !meet.trim()) return [];
  return meet.split("|").map((part) => {
    const p = part.replace(/\*\*\*/g, "").trim();
    const m = p.match(/^([A-Za-z]+)\s+(\d{1,2}\.\d{2})-(\d{1,2}\.\d{2})/);
    if (!m) return { days: [], start: null, end: null, start_dt, end_dt, facility: null, instructor: null };
    const days = parseDays(m[1]);
    return { days, start: parseTime(m[2]), end: parseTime(m[3]), start_dt, end_dt, facility: null, instructor: null };
  });
}

function datesOverlap(a: Meeting, b: Meeting): boolean {
  // Missing dates = assume whole term (overlaps everything)
  if (!a.start_dt || !a.end_dt || !b.start_dt || !b.end_dt) return true;
  return a.start_dt <= b.end_dt && b.start_dt <= a.end_dt;
}

export function meetingsConflict(a: Meeting, b: Meeting): boolean {
  if (a.start == null || a.end == null || b.start == null || b.end == null) return false;
  if (!a.days.some((d) => b.days.includes(d))) return false;
  if (!(a.start < b.end && b.start < a.end)) return false;
  return datesOverlap(a, b);
}

export interface Conflict {
  a: number; // class_nbr
  b: number;
  reason: string;
}

export function sectionsConflict(a: Section, b: Section): string | null {
  for (const ma of a.meetings) {
    for (const mb of b.meetings) {
      if (meetingsConflict(ma, mb)) {
        const sameDates = ma.start_dt === mb.start_dt && ma.end_dt === mb.end_dt;
        return `${a.course} #${a.class_nbr} (${fmtMeeting(ma)}) overlaps ${b.course} #${b.class_nbr} (${fmtMeeting(mb)})${sameDates ? "" : " during overlapping dates"}`;
      }
    }
  }
  return null;
}

/** Pairwise conflicts among a set of sections. */
export function findConflicts(sections: Section[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const r = sectionsConflict(sections[i], sections[j]);
      if (r) out.push({ a: sections[i].class_nbr, b: sections[j].class_nbr, reason: r });
    }
  }
  return out;
}

/** Earliest start (minutes) across meetings, or null if TBA. */
export function earliestStart(s: Section): number | null {
  const starts = s.meetings.map((m) => m.start).filter((x): x is number => x != null);
  return starts.length ? Math.min(...starts) : null;
}

export function latestEnd(s: Section): number | null {
  const ends = s.meetings.map((m) => m.end).filter((x): x is number => x != null);
  return ends.length ? Math.max(...ends) : null;
}

export function sectionDays(s: Section): DayCode[] {
  const set = new Set<DayCode>();
  for (const m of s.meetings) for (const d of m.days) set.add(d);
  return DAY_ORDER.filter((d) => set.has(d));
}

/** A section shorter than this many days is a half-term ("quarter") section. */
const HALF_TERM_MAX_DAYS = 70;
/** A short section starting within this many days of the term start is in the first half. */
const FIRST_HALF_START_SLACK_DAYS = 10;

/**
 * Which half of the term a section occupies: 'A' (first 7 weeks), 'B' (second), 'full', or 'unknown'.
 * Decided from the section's own dates against the term's halves. When the term has no half dates, a short
 * (< 70-day) section is 'A' if it starts within 10 days of the term start or in the first half of the term
 * span, else 'B'; with no term dates at all the calendar month decides (Jan/Feb/Aug/Sep → A, Mar/Apr/Oct/Nov → B).
 */
export function quarterOf(
  s: { start_dt: string | null; end_dt: string | null },
  term: {
    q_a_start?: string | null; q_a_end?: string | null; q_b_start?: string | null; q_b_end?: string | null;
    start_date?: string | null; end_date?: string | null;
  } | null,
): "A" | "B" | "full" | "unknown" {
  if (!s.start_dt || !s.end_dt) return "unknown";
  if (term?.q_a_end && s.end_dt <= term.q_a_end) return "A";
  if (term?.q_b_start && s.start_dt >= term.q_b_start) return "B";
  const start = Date.parse(s.start_dt);
  const end = Date.parse(s.end_dt);
  if (Number.isNaN(start) || Number.isNaN(end)) return "unknown";
  const days = (end - start) / 86400000;
  if (days >= HALF_TERM_MAX_DAYS) return "full";
  // short section, no half dates on the term: place it by where it starts in the term span
  const termStart = term?.q_a_start ?? term?.start_date ?? null;
  const termEnd = term?.q_b_end ?? term?.end_date ?? null;
  const ts = termStart ? Date.parse(termStart) : NaN;
  if (!Number.isNaN(ts)) {
    if ((start - ts) / 86400000 <= FIRST_HALF_START_SLACK_DAYS) return "A";
    const te = termEnd ? Date.parse(termEnd) : NaN;
    if (!Number.isNaN(te)) return start < (ts + te) / 2 ? "A" : "B";
    return "B";
  }
  const month = parseInt(s.start_dt.slice(5, 7), 10);
  if ([1, 2, 8, 9].includes(month)) return "A";
  if ([3, 4, 10, 11].includes(month)) return "B";
  return "unknown";
}
