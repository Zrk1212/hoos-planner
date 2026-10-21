import { describe, expect, it } from "vitest";
import type { RatingMap } from "@/lib/catalog";
import { fromSeedMeet } from "@/lib/meetings";
import { cartCredits, cartCreditsDetail, searchSections } from "@/lib/search";
import type { Section } from "@/lib/types";

const sec = (over: Partial<Section> & { course: string; class_nbr: number }): Section => {
  const [subject, catalog_nbr] = over.course.split(" ");
  return {
    term: "1272", subject, catalog_nbr, class_section: "001", descr: over.course, topic: null, component: "LEC", section_type: null,
    units: "3", units_min: 3, units_max: 3, grading_basis: "Graded", acad_group: "CGAS", acad_org: null, session_descr: null,
    start_dt: "2027-01-20", end_dt: "2027-05-04", enrl_stat: "O", class_capacity: 30, enrollment_total: 0, enrollment_available: 30,
    wait_cap: 0, wait_tot: 0, rqmnt_designtn: null, attrs: [], instructors: [], instructor_names: null,
    meetings: fromSeedMeet("MoWe 14.00-15.15", "2027-01-20", "2027-05-04"), reserve_caps: [], instruction_mode_descr: null,
    ...over,
  };
};
const rated: RatingMap = { "MUSI 2072": { overall: { course: "MUSI 2072", instructor: "", rating: 4.5, difficulty: 2, gpa: 3.8, last_term: null, tcf_path: null }, instructors: {} } };
const beatles = sec({ course: "MUSI 2072", class_nbr: 1, descr: "Meet the Beatles" });
const econ = sec({ course: "ECON 2010", class_nbr: 2, descr: "Principles of Microeconomics" });
const nbrs = (xs: ReturnType<typeof searchSections>) => xs.map((x) => x.section.class_nbr).sort();

describe("search – subject shortcut only for real subjects (C10)", () => {
  it("a 2–4-letter query that is not a subject is text search", () => {
    expect(nbrs(searchSections([beatles, econ], {}, null, { query: "beat" }))).toEqual([1]);
    expect(nbrs(searchSections([beatles, econ], {}, null, { query: "econ" }))).toEqual([2]);
    expect(nbrs(searchSections([beatles, econ], {}, null, { query: "econ 2010" }))).toEqual([2]);
  });
  it("honours a caller-supplied subject set", () => {
    expect(nbrs(searchSections([beatles, econ], {}, null, { query: "beat", subjects: new Set(["MUSI", "ECON"]) }))).toEqual([1]);
    expect(nbrs(searchSections([beatles, econ], {}, null, { query: "musi", subjects: new Set(["MUSI", "ECON"]) }))).toEqual([1]);
  });
});

describe("search – rating filters and unrated sections (W8/W9)", () => {
  it("rating filters drop unrated sections unless includeUnrated", () => {
    expect(nbrs(searchSections([beatles, econ], rated, null, { maxDifficulty: 3 }))).toEqual([1]);
    expect(nbrs(searchSections([beatles, econ], rated, null, { maxDifficulty: 3, includeUnrated: true }))).toEqual([1, 2]);
    expect(nbrs(searchSections([beatles, econ], rated, null, { maxDifficulty: 1 }))).toEqual([]);
    expect(nbrs(searchSections([beatles, econ], rated, null, { minRating: 4 }))).toEqual([1]);
    expect(nbrs(searchSections([beatles, econ], rated, null, { minRating: 4, includeUnrated: true }))).toEqual([1, 2]);
    expect(nbrs(searchSections([beatles, econ], rated, null, { minGpa: 3.5 }))).toEqual([1]);
    expect(nbrs(searchSections([beatles, econ], rated, null, { minGpa: 3.9, includeUnrated: true }))).toEqual([2]);
  });
});

describe("search – days and TBA handling (C21)", () => {
  const daysNoTime = sec({ course: "ARTS 2000", class_nbr: 3, meetings: [{ days: ["Mo", "We"], start: null, end: null, start_dt: "2027-01-20", end_dt: "2027-05-04", facility: null, instructor: null }] });
  const tba = sec({ course: "ARTS 2610", class_nbr: 4, meetings: fromSeedMeet("TBA - ***", "2027-01-20", "2027-05-04") });
  const timed = sec({ course: "ECON 2020", class_nbr: 5 }); // MoWe 2–3:15
  it("a days filter requires days; TBA time is dropped only by a time filter", () => {
    expect(nbrs(searchSections([daysNoTime, tba, timed], {}, null, { days: ["Mo", "We", "Fr"] }))).toEqual([3, 5]);
    expect(nbrs(searchSections([daysNoTime, tba, timed], {}, null, { days: ["Mo", "We"], earliestStart: 600 }))).toEqual([5]);
    expect(nbrs(searchSections([daysNoTime, tba, timed], {}, null, { days: ["Mo", "We"], earliestStart: 600, includeTba: true }))).toEqual([3, 5]);
    expect(nbrs(searchSections([daysNoTime, tba, timed], {}, null, { days: ["Tu", "Th"] }))).toEqual([]);
  });
  it("latestEnd treats TBA like earliestStart does", () => {
    expect(nbrs(searchSections([tba, timed], {}, null, { latestEnd: 1000 }))).toEqual([5]);
    expect(nbrs(searchSections([tba, timed], {}, null, { latestEnd: 1000, includeTba: true }))).toEqual([4, 5]);
    expect(nbrs(searchSections([tba, timed], {}, null, { latestEnd: 900 }))).toEqual([]);
    expect(nbrs(searchSections([tba, timed], {}, null, {}))).toEqual([4, 5]);
  });
});

describe("search – cart credits (C7)", () => {
  it("variable-unit sections count at units_min with a note; empty units are 0", () => {
    const vari = sec({ course: "MUSI 3390", class_nbr: 6, units: "1 - 12", units_min: 1, units_max: 12 });
    const empty = sec({ course: "XYZ 1000", class_nbr: 7, units: "", units_min: null, units_max: null });
    const d = cartCreditsDetail([vari, empty, econ]);
    expect(d.credits).toBe(4);
    expect(d.notes.join(" ")).toMatch(/variable units/);
    expect(cartCredits([empty])).toBe(0);
    expect(cartCredits([sec({ course: "MUSI 3390", class_nbr: 8, units: "1 - 12", units_min: null, units_max: null })])).toBe(1);
  });
});
