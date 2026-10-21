import { describe, expect, it } from "vitest";
import { findConflicts, fromSeedMeet, fromSisMeeting, meetingsConflict, parseTime, quarterOf } from "@/lib/meetings";
import type { Section } from "@/lib/types";

const sec = (class_nbr: number, meet: string, start = "2027-01-20", end = "2027-05-04"): Section => ({
  term: "1272", class_nbr, subject: "X", catalog_nbr: String(class_nbr), course: `X ${class_nbr}`,
  class_section: "001", descr: "", topic: null, component: "LEC", section_type: null, units: "3", units_min: 3, units_max: 3,
  grading_basis: "Graded", acad_group: "CGAS", acad_org: null, session_descr: null, start_dt: start, end_dt: end,
  enrl_stat: "O", class_capacity: 10, enrollment_total: 0, enrollment_available: 10, wait_cap: 0, wait_tot: 0,
  rqmnt_designtn: null, attrs: [], instructors: [], instructor_names: null, meetings: fromSeedMeet(meet, start, end),
  reserve_caps: [], instruction_mode_descr: null,
});

describe("meeting parsing", () => {
  it("parses SIS times", () => {
    expect(parseTime("14.00.00.000000")).toBe(840);
    expect(parseTime("08.00")).toBe(480);
    expect(parseTime("")).toBeNull();
  });
  it("parses seed meet strings", () => {
    const m = fromSeedMeet("MoWe 14.00-15.15 ***", "2027-01-20", "2027-05-04");
    expect(m).toHaveLength(1);
    expect(m[0].days).toEqual(["Mo", "We"]);
    expect(m[0].start).toBe(840);
    expect(m[0].end).toBe(915);
    const two = fromSeedMeet("Th 14.00-15.15 *** | MoWeFr 12.00-12.50 ***", null, null);
    expect(two).toHaveLength(2);
    expect(two[1].days).toEqual(["Mo", "We", "Fr"]);
    expect(fromSeedMeet("TBA - ***", null, null)[0].start).toBeNull();
  });
  it("normalizes raw SIS meetings", () => {
    const m = fromSisMeeting({ days: "TuTh", start_time: "12.30.00.000000", end_time: "13.45.00.000000", start_dt: "01/20/2027", end_dt: "05/04/2027", facility_descr: "***", instructor: "Abby Fines,\n\rMichael Shipe" });
    expect(m.days).toEqual(["Tu", "Th"]);
    expect(m.start).toBe(750);
    expect(m.start_dt).toBe("2027-01-20");
    expect(m.instructor).toBe("Abby Fines, Michael Shipe");
  });
});

describe("conflicts", () => {
  it("detects overlap on shared days", () => {
    const a = sec(1, "TuTh 12.30-13.45");
    const b = sec(2, "TuTh 12.30-13.45");
    expect(findConflicts([a, b])).toHaveLength(1);
  });
  it("no conflict on different days or adjacent times", () => {
    expect(findConflicts([sec(1, "MoWe 14.00-15.15"), sec(2, "TuTh 14.00-15.15")])).toHaveLength(0);
    expect(findConflicts([sec(1, "MoWe 14.00-15.15"), sec(2, "MoWe 15.15-16.30")])).toHaveLength(0);
  });
  it("Q3 and Q4 engagements in the same slot do not conflict", () => {
    const q3 = sec(1, "MoWe 12.30-13.45", "2027-01-20", "2027-03-16");
    const q4 = sec(2, "MoWe 12.30-13.45", "2027-03-17", "2027-05-04");
    expect(findConflicts([q3, q4])).toHaveLength(0);
    const full = sec(3, "MoWe 12.30-13.45");
    expect(findConflicts([q3, full])).toHaveLength(1);
  });
  it("TBA never conflicts", () => {
    expect(meetingsConflict(fromSeedMeet("TBA - ***", null, null)[0], fromSeedMeet("MoWe 14.00-15.15", null, null)[0])).toBe(false);
  });
  it("quarterOf", () => {
    const term = { q_a_start: "2027-01-20", q_a_end: "2027-03-16", q_b_start: "2027-03-17", q_b_end: "2027-05-04" };
    expect(quarterOf({ start_dt: "2027-01-20", end_dt: "2027-03-16" }, term)).toBe("A");
    expect(quarterOf({ start_dt: "2027-03-17", end_dt: "2027-05-04" }, term)).toBe("B");
    expect(quarterOf({ start_dt: "2027-01-20", end_dt: "2027-05-04" }, term)).toBe("full");
  });
});

describe("quarterOf without half dates (C13)", () => {
  it("places short sections by where they start in the term span", () => {
    const term = { start_date: "2027-01-20", end_date: "2027-05-04" };
    expect(quarterOf({ start_dt: "2027-01-20", end_dt: "2027-03-16" }, term)).toBe("A");
    expect(quarterOf({ start_dt: "2027-01-27", end_dt: "2027-03-16" }, term)).toBe("A"); // within 10 days
    expect(quarterOf({ start_dt: "2027-03-17", end_dt: "2027-05-04" }, term)).toBe("B");
    expect(quarterOf({ start_dt: "2027-01-20", end_dt: "2027-05-04" }, term)).toBe("full");
  });
  it("falls back to the calendar month with no term dates at all", () => {
    expect(quarterOf({ start_dt: "2027-01-20", end_dt: "2027-03-16" }, null)).toBe("A");
    expect(quarterOf({ start_dt: "2027-03-17", end_dt: "2027-05-04" }, null)).toBe("B");
    expect(quarterOf({ start_dt: "2026-08-25", end_dt: "2026-10-14" }, {})).toBe("A");
    expect(quarterOf({ start_dt: "2026-10-15", end_dt: "2026-12-08" }, {})).toBe("B");
    expect(quarterOf({ start_dt: "2027-01-20", end_dt: "2027-05-04" }, null)).toBe("full");
    expect(quarterOf({ start_dt: null, end_dt: null }, null)).toBe("unknown");
  });
});
