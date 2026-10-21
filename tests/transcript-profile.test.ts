import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTranscriptProfile, sisTermName, type TranscriptJson } from "@/lib/live/sis";

const raw = JSON.parse(readFileSync("tests/fixtures/sis-transcript.json", "utf8")) as TranscriptJson;
// mid-October 2026: Spring 2026 is past (grades expected), Fall 2026 is current
const NOW = new Date("2026-10-20T12:00:00-04:00");
const build = (edit?: (j: TranscriptJson) => void) => { const j = structuredClone(raw); edit?.(j); return buildTranscriptProfile(j, NOW); };
const get = (p: ReturnType<typeof build>, course: string, title?: string) => p.courses.filter((c) => c.course === course && (title === undefined || c.title === title));

describe("buildTranscriptProfile (SIS unofficial-transcript JSON)", () => {
  it("graded rows are completed with units_earned; ungraded rows are in progress with units_attempted", () => {
    const p = build();
    expect(get(p, "HIUS 2001")[0]).toMatchObject({ status: "completed", credits: 3, grade: "B+", term: "Spring 2026" });
    expect(get(p, "PHYS 1010")[0]).toMatchObject({ status: "completed", credits: 0, grade: "W" });
    expect(get(p, "COMM 1800")[0]).toMatchObject({ status: "in_progress", credits: 3, term: "Fall 2026" });
    expect(get(p, "COMM 1800")[0].grade).toBeUndefined();
  });

  it("a retake keeps the non-failing attempt (F in spring, in progress in fall → one in-progress row)", () => {
    const rows = get(build(), "SPAN 1010");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "in_progress", term: "Fall 2026", credits: 4 });
  });

  it("same course with different topics stays as two rows", () => {
    const rows = get(build(), "EGMT 1520");
    expect(rows.map((r) => r.title).sort()).toEqual(["Empirical & Scientific Engagement: Numbers and Noise", "Empirical & Scientific Engagement: Reading the Climate"]);
  });

  it("test credit beats an ungraded enrollment of the same course and keeps SIS's TE grade", () => {
    const rows = get(build(), "MATH 1310");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "test", grade: "TE", credits: 4 });
    expect(get(build(), "HIST 1000T")[0]).toMatchObject({ status: "test", generic: true, credits: 3 });
    expect(get(build(), "CS 1000T")[0]).toMatchObject({ status: "test", generic: true, credits: 0, grade: "TE" });
  });

  it("placement rows are not courses; only a language subject above 2020 sets worldLanguagePlacement", () => {
    const p = build();
    expect(p.courses.some((c) => /P$/.test(c.course))).toBe(false);
    expect(p.worldLanguagePlacement).toBe(true);
    const lower = build((j) => { j.test.test_credit!.programs![0].terms![0].tests = [{ course: "SPAN 2020P", course_title: "", attempted: 0, earned: 0, grade: "" }]; });
    expect(lower.worldLanguagePlacement).toBe(false);
    const math = build((j) => { j.test.test_credit!.programs![0].terms![0].tests = [{ course: "MATH 3010P", course_title: "", attempted: 0, earned: 0, grade: "" }]; });
    expect(math.worldLanguagePlacement).toBe(false);
  });

  it("a past term with no grades stays in progress and is noted as 'grades not yet posted'", () => {
    const p = build((j) => { for (const e of j.enrollments["1262"].enrollments) e.grade = ""; });
    expect(get(p, "HIUS 2001")[0]).toMatchObject({ status: "in_progress", credits: 3 });
    expect(p.notes.some((n) => /Spring 2026: grades not yet posted/.test(n))).toBe(true);
    expect(build().notes.some((n) => /grades not yet posted/.test(n))).toBe(false);
  });

  it("test scores, program and term names", () => {
    const p = build();
    expect(p.tests).toEqual([{ exam: "AP Calculus AB", score: "5" }, { exam: "AP Computer Science Principles", score: "5" }]);
    expect(p.program).toBe("Arts & Sciences Undergraduate — Undeclared");
    expect(p.sourceFormat).toBe("sis-transcript");
    expect(sisTermName("2027 Spring")).toBe("Spring 2027");
    expect(sisTermName("Weird")).toBe("Weird");
  });

  it("tolerates missing sections", () => {
    const p = buildTranscriptProfile({ terms: [], enrollments: {}, test: {}, transfer: null, programs: {}, scores: null }, NOW);
    expect(p.courses).toEqual([]);
    expect(p.worldLanguagePlacement).toBe(false);
    expect(p.program).toBeUndefined();
  });
});
