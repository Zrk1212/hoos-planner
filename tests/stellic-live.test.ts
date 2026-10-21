import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAudit } from "@/lib/audit-parser";
import { evaluate } from "@/lib/requirements";
import { summarizeAuditBlocks, trimStellic } from "@/lib/live/stellic";

const audit = readFileSync("tests/fixtures/stellic-audit.txt", "utf8");
const courses = readFileSync("tests/fixtures/stellic-courses.txt", "utf8");
const get = (p: ReturnType<typeof parseAudit>, c: string) => p.courses.find((x) => x.course === c);

describe("real Stellic text (captured 2026-10-20)", () => {
  it("Courses page: transfer rows, enrolled rows, test scores, placement", () => {
    const p = parseAudit(trimStellic(courses));
    expect(get(p, "MATH 1310")).toMatchObject({ status: "transfer", credits: 4, term: "Fall 2026" });
    expect(get(p, "CS 1000T")).toMatchObject({ status: "test", generic: true });
    expect(get(p, "COMM 1800")).toMatchObject({ status: "in_progress", credits: 3, term: "Fall 2026" });
    expect(get(p, "EGMT 1520")).toMatchObject({ status: "in_progress", credits: 2 });
    expect(get(p, "SPAN 3010")).toBeUndefined();
    expect(get(p, "SPAN 3010P")).toBeUndefined();
    expect(p.worldLanguagePlacement).toBe(true);
    expect(p.courses.map((c) => c.course)).not.toContain("JUNE 2026");
    expect(p.tests.find((t) => /Calculus AB/.test(t.exam))?.score).toBe("5");
    expect(p.tests.find((t) => /Computer Science Principles/.test(t.exam))?.score).toBe("4");
    expect(p.courses).toHaveLength(13); // 7 transfer rows (placement excluded) + 6 enrolled
  });
  it("Audit page: Remaining rows are skipped, Taken+TE rows are transfer, In Progress rows in progress", () => {
    const p = parseAudit(trimStellic(audit));
    expect(get(p, "EGMT 1530")).toBeUndefined();
    expect(get(p, "EGMT 1540")).toBeUndefined();
    expect(get(p, "EGMT 1510")).toMatchObject({ status: "in_progress", term: "Fall 2026" });
    expect(get(p, "BIOL 2200")).toMatchObject({ status: "transfer", credits: 4 });
    expect(get(p, "ECON 2020")).toMatchObject({ status: "transfer" });
    const st = evaluate({ profile: p });
    expect(st.engagements.remaining).toEqual(["1530", "1540"]);
    expect(st.disciplines.unmet.sort()).toEqual(["AIP", "CMP", "CSW", "HP", "SS"]);
    expect(st.literacies.worldLanguage.status).toBe("done");
  });
  it("generic test credit with a header-like title stays test credit", () => {
    const p = parseAudit("Taken\nCS 1000T\nNon-UVa Transfer/Test Credit\n3 CREDITS\nTRANSFERRED FALL '26\nTE\nTaken\nECON 2020\nPrinciples of Economics: Macroeconomics\n3 CREDITS\nTRANSFERRED FALL '26\nTE");
    expect(get(p, "CS 1000T")).toMatchObject({ status: "test", generic: true, credits: 3, grade: "T" });
    expect(get(p, "ECON 2020")).toMatchObject({ status: "transfer", credits: 3 });
    const full = parseAudit(trimStellic(audit));
    expect(full.courses.filter((c) => c.generic).every((c) => c.status === "test" || c.status === "transfer")).toBe(true);
  });
  it("summarizes Stellic's own verdict blocks", () => {
    const s = summarizeAuditBlocks(trimStellic(audit));
    expect(s).toMatch(/The Engagements: 4 remaining/);
    expect(s).toMatch(/Second Writing Requirement: 3 remaining/);
    expect(s).toMatch(/Living Systems \(LS\): satisfied/);
  });
});
