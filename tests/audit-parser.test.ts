import { describe, expect, it } from "vitest";
import { apEquivalents, parseAudit } from "@/lib/audit-parser";
import { SIS_SAMPLE, STELLIC_SAMPLE } from "./fixtures";

const get = (p: ReturnType<typeof parseAudit>, course: string) => p.courses.find((c) => c.course === course);

describe("parseAudit – Stellic", () => {
  const p = parseAudit(STELLIC_SAMPLE);
  it("detects format and program", () => {
    expect(p.sourceFormat).toBe("stellic");
    expect(p.pathway).toBe("engagements");
    expect(p.program).toMatch(/Arts & Sciences Undeclared/);
  });
  it("completed / in-progress rows", () => {
    expect(get(p, "EGMT 1510")).toMatchObject({ status: "completed", grade: "A-", credits: 2, term: "Fall 2026" });
    expect(get(p, "EGMT 1520")).toMatchObject({ status: "in_progress", credits: 2 });
    expect(get(p, "COMM 1800")).toMatchObject({ status: "in_progress", credits: 3 });
    expect(get(p, "ECON 2010")).toMatchObject({ status: "in_progress", credits: 3 });
    expect(get(p, "ENWR 1510")).toMatchObject({ status: "in_progress", credits: 3 });
  });
  it("TRANSFERRED … TE rows become transfer/test credit", () => {
    expect(get(p, "MATH 1310")).toMatchObject({ credits: 4, grade: "T" });
    expect(["transfer", "test"]).toContain(get(p, "MATH 1310")!.status);
    expect(get(p, "BIOL 2100")!.credits).toBe(4);
    expect(get(p, "CS 1000T")).toMatchObject({ generic: true });
  });
  it("unsatisfied rows are not recorded as courses", () => {
    expect(get(p, "EGMT 1530")).toBeUndefined();
    expect(get(p, "EGMT 1540")).toBeUndefined();
  });
  it("AP scores and placement", () => {
    expect(p.tests.map((t) => t.exam)).toContain("AP Calculus AB");
    expect(p.tests.find((t) => t.exam === "AP Calculus AB")!.score).toBe("5");
    expect(p.worldLanguagePlacement).toBe(true);
    expect(get(p, "SPAN 3010P")).toBeUndefined();
  });
});

describe("parseAudit – SIS transcript", () => {
  const p = parseAudit(SIS_SAMPLE);
  it("test credit rows", () => {
    expect(p.sourceFormat).toBe("sis-transcript");
    expect(get(p, "MATH 1310")).toMatchObject({ status: "test", credits: 4 });
    expect(get(p, "BIOL 2200")).toMatchObject({ status: "test", credits: 4 });
    expect(get(p, "CS 1000T")).toMatchObject({ status: "test", generic: true });
    expect(p.tests.find((t) => /Calculus AB/.test(t.exam))?.awarded).toContain("MATH 1310");
  });
  it("term rows: graded = completed, ungraded = in progress", () => {
    expect(get(p, "EGMT 1510")).toMatchObject({ status: "completed", grade: "A-", credits: 2, term: "Fall 2026" });
    expect(get(p, "COMM 1800")).toMatchObject({ status: "in_progress", credits: 3, term: "Fall 2026" });
    expect(get(p, "ENTP 1010")).toMatchObject({ status: "in_progress", credits: 3 });
  });
  it("does not invent courses from totals lines", () => {
    expect(p.courses.every((c) => /^[A-Z]{2,4} \d{4}[A-Z]?$/.test(c.course))).toBe(true);
    expect(p.courses.length).toBe(11);
  });
});

describe("parseAudit – placement after an AP line", () => {
  it("does not treat a placement code on the next line as awarded AP credit", () => {
    const p = parseAudit(`MATH 1310 Calculus I 4 TE TRANSFERRED\nAP Calculus AB (5)\nWorld Language: satisfied by placement (SPAN 3010P)`);
    expect(get(p, "SPAN 3010P")).toBeUndefined();
    expect(p.worldLanguagePlacement).toBe(true);
    expect(get(p, "MATH 1310")!.credits).toBe(4);
  });
});

describe("parseAudit – freeform", () => {
  it("handles a casual list", () => {
    const p = parseAudit(`took ECON 2010 (A) and ENWR 1510 (B+) in fall 2026, currently taking COMM 1800. AP Calc AB 5`);
    expect(get(p, "ECON 2010")).toMatchObject({ status: "completed", grade: "A" });
    expect(get(p, "COMM 1800")!.status).toBe("in_progress");
  });
});

describe("parseAudit – World Language only from hard evidence (C1)", () => {
  const wl = (t: string) => parseAudit(`${t}\nECON 2010 Micro 3 A Fall 2025 COMPLETED`).worldLanguagePlacement;
  it("negated or heading-only lines do not satisfy", () => {
    expect(wl("World Language — Not satisfied")).toBe(false);
    expect(wl("World Language: unsatisfied")).toBe(false);
    expect(wl("World Language requirement incomplete")).toBe(false);
    expect(wl("World Language Placement Option\nfulfill any\nUVA Spanish Placement Exam")).toBe(false);
    expect(wl("Spanish placement: placed into SPAN 1020")).toBe(false);
  });
  it("placement code at/above 2020, diagnostic ≥ 6, or an un-negated satisfied line do", () => {
    expect(wl("World Language: satisfied")).toBe(true);
    expect(wl("World Language requirement complete")).toBe(true);
    expect(wl("SPAN 3010P\nPlacement Credit for SPAN 3010")).toBe(true);
    expect(wl("FREN 2020P Placement Credit for FREN 2020")).toBe(true);
    expect(wl("SPAN 1020P Placement Credit for SPAN 1020")).toBe(false);
    expect(wl("UVWLPD_SPPLD\nUVWLPD - Spanish Place Diagnostic\nTAKEN 10 JUNE 2026\n6.25")).toBe(true);
    expect(wl("UVWLPD - Spanish Place Diagnostic 6.25")).toBe(true);
    expect(wl("UVWLPD - Spanish Place Diagnostic\nTAKEN 10 JUNE 2026\n4.5")).toBe(false);
  });
});

describe("parseAudit – grade token (C3)", () => {
  it("does not read a title word as the grade", () => {
    const c = get(parseAudit("MATH 1210 A Survey of Calculus I 3 Fall 2026 CURRENTLY TAKING"), "MATH 1210")!;
    expect(c.grade).toBeUndefined();
    expect(c.status).toBe("in_progress");
    expect(c.credits).toBe(3);
  });
  it("takes the last grade token after the credits", () => {
    expect(get(parseAudit("MATH 1210 A Survey of Calculus I 3 A- Fall 2025 COMPLETED"), "MATH 1210")).toMatchObject({ grade: "A-", status: "completed" });
    expect(get(parseAudit("COMM 1800 Foundations of Commerce 3.000 3.000 A 12.000"), "COMM 1800")).toMatchObject({ grade: "A", credits: 3 });
    expect(get(parseAudit("ECON 2010 Micro A"), "ECON 2010")!.grade).toBe("A");
  });
});

describe("parseAudit – retakes (C5)", () => {
  it("a passing grade beats W/F/NC in either order", () => {
    expect(get(parseAudit("ECON 2010 Micro 3 W Fall 2025\nECON 2010 Micro 3 B+ Spring 2026"), "ECON 2010")).toMatchObject({ grade: "B+", term: "Spring 2026" });
    expect(get(parseAudit("ECON 2010 Micro 3 B+ Spring 2026\nECON 2010 Micro 3 W Fall 2025"), "ECON 2010")).toMatchObject({ grade: "B+", term: "Spring 2026" });
    expect(get(parseAudit("ECON 2010 Micro 3 F Fall 2025\nECON 2010 Micro 3 C Spring 2026"), "ECON 2010")!.grade).toBe("C");
  });
  it("W followed by an in-progress retake keeps the in-progress row", () => {
    expect(get(parseAudit("ECON 2010 Micro 3 W Fall 2025 COMPLETED\nECON 2010 Micro 3 Fall 2026 CURRENTLY TAKING"), "ECON 2010")).toMatchObject({ status: "in_progress", term: "Fall 2026" });
  });
  it("a later term wins between two passing attempts", () => {
    expect(get(parseAudit("ECON 2010 Micro 3 C Fall 2025\nECON 2010 Micro 3 A Spring 2026"), "ECON 2010")!.grade).toBe("A");
    expect(get(parseAudit("ECON 2010 Micro 3 A Spring 2026\nECON 2010 Micro 3 C Fall 2025"), "ECON 2010")!.grade).toBe("A");
  });
});

describe("parseAudit – wrap logic (C11)", () => {
  it("a term-only line belongs to the rows after it, not the row before", () => {
    for (const termLine of ["2026 Fall", "Fall 2026"]) {
      const p = parseAudit(`ECON 2010 Principles of Microeconomics\n${termLine}\nCOMM 1800 Foundations 3 A`);
      expect(get(p, "ECON 2010")!.term).toBeUndefined();
      expect(get(p, "COMM 1800")!.term).toBe("Fall 2026");
    }
  });
  it("a section header is not pulled into the previous row", () => {
    const p = parseAudit("ECON 2010 Principles of Microeconomics\nCurrently taking (Fall 2026)\nCOMM 1800 Foundations 3");
    expect(get(p, "ECON 2010")!.term).toBeUndefined();
    expect(get(p, "COMM 1800")).toMatchObject({ status: "in_progress", term: "Fall 2026" });
  });
  it("still absorbs a Stellic record's own chip line", () => {
    const p = parseAudit("In Progress\nEGMT 1510\nEngaging Aesthetics\n2 CREDITS\nCURRENTLY TAKING IN FALL REGULAR ACADEMIC SESSION '26");
    expect(get(p, "EGMT 1510")).toMatchObject({ status: "in_progress", term: "Fall 2026", credits: 2 });
  });
});

describe("parseAudit – AP table follows docs/mcintire-admission.md §5 (C4)", () => {
  const courses = (exam: string, score: string) => apEquivalents(exam, score).map((c) => `${c.course}${c.generic ? "T" : ""}`);
  it("Micro/Macro: 5 → ECON 2010/2020, 4 → ECON 1000T generic", () => {
    expect(apEquivalents("AP Microeconomics", "5")).toMatchObject([{ course: "ECON 2010", generic: false }]);
    expect(apEquivalents("AP Microeconomics", "4")).toMatchObject([{ course: "ECON 1000T", generic: true }]);
    expect(apEquivalents("AP Macroeconomics", "5")).toMatchObject([{ course: "ECON 2020" }]);
    expect(apEquivalents("AP Macroeconomics", "4")).toMatchObject([{ course: "ECON 1000T", generic: true }]);
    expect(apEquivalents("AP Microeconomics", "3")).toEqual([]);
  });
  it("Statistics: 5 → STAT 2120, 4 → STAT 1120; Calculus unchanged", () => {
    expect(apEquivalents("AP Statistics", "5")).toMatchObject([{ course: "STAT 2120" }]);
    expect(apEquivalents("AP Statistics", "4")).toMatchObject([{ course: "STAT 1120" }]);
    expect(courses("AP Calculus AB", "4")).toEqual(["MATH 1310"]);
    expect(courses("AP Calculus BC", "5")).toEqual(["MATH 1310", "MATH 1320"]);
  });
});

describe("parseAudit – small parser items", () => {
  it("month names, CLASS OF, FA/SP abbreviations are not courses", () => {
    const p = parseAudit("JAN 2027\nMARCH 2027\nCLASS OF 2030\nFA 2026\nSP 2027\nTAKEN 25 JUNE 2026\nECON 2010 Micro 3 A");
    expect(p.courses.map((c) => c.course)).toEqual(["ECON 2010"]);
  });
  it("AP Physics 1 (5) is score 5", () => {
    const p = parseAudit("AP Physics 1 (5)\nAP Calculus AB 5");
    expect(p.tests.find((t) => /Physics/.test(t.exam))).toMatchObject({ exam: "AP Physics 1", score: "5" });
    expect(p.tests.find((t) => /Calculus AB/.test(t.exam))!.score).toBe("5");
  });
  it("'future' / 'complete' inside a title do not change the status", () => {
    const p = parseAudit("PHIL 1000 The Future of Humanity 3 A Fall 2025 COMPLETED\nHIST 1501 Complete History of Rome 3 Fall 2026 CURRENTLY TAKING");
    expect(get(p, "PHIL 1000")!.status).toBe("completed");
    expect(get(p, "HIST 1501")!.status).toBe("in_progress");
  });
  it("credits are the number nearest the grade", () => {
    expect(get(parseAudit("SPAN 1010 Elementary Spanish 1 4 A"), "SPAN 1010")).toMatchObject({ credits: 4, grade: "A" });
    expect(get(parseAudit("SPAN 1010 Elementary Spanish 1 4 A Fall 2025 COMPLETED"), "SPAN 1010")!.credits).toBe(4);
  });
});

describe("pastes students actually type", () => {
  it("reads short AP names", () => {
    const p = parseAudit("AP Calc BC 5\nAP Lang 5\nAP Bio 4\nAPUSH 4");
    expect(p.courses.map((c) => c.course).sort()).toEqual(["BIOL 2100", "BIOL 2200", "ENGL 1000T", "HIST 1000T", "MATH 1310", "MATH 1320"]);
  });
  it("honors a status word in front of a condensed Stellic row", () => {
    const p = parseAudit("Remaining EGMT 1530 Engaging Differences 2 CREDITS\nIn Progress EGMT 1520 Exploding Stars 2 CREDITS CURRENTLY TAKING IN FALL '26\nTaken ENWR 1510 Writing 3 CREDITS A");
    expect(p.courses.map((c) => `${c.course}:${c.status}`).sort()).toEqual(["EGMT 1520:in_progress", "ENWR 1510:completed"]);
  });
});
