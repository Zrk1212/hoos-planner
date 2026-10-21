import { describe, expect, it } from "vitest";
import { companionProblems, companionSections } from "@/lib/search";
import type { Section } from "@/lib/types";

const sec = (class_nbr: number, component: string, class_section: string, course = "ECON 2010") =>
  ({ class_nbr, component, class_section, course, subject: course.split(" ")[0], catalog_nbr: course.split(" ")[1], meetings: [], attrs: [], reserve_caps: [] }) as unknown as Section;

const all = [sec(10773, "LEC", "100"), sec(12099, "LEC", "200"), sec(10927, "DIS", "101"), sec(10928, "DIS", "102"), sec(10950, "DIS", "201"), sec(10951, "DIS", "202")];

describe("lecture/discussion pairing", () => {
  it("offers only the lecture's own hundreds", () => {
    expect(companionSections(all[1], all).map((s) => s.class_nbr)).toEqual([10950, 10951]);
  });
  it("flags a discussion from another lecture", () => {
    const p = companionProblems([all[1], all[3]], all);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/#10928 .* doesn't go with lecture ECON 2010-200/);
  });
  it("flags a missing discussion and accepts a matching one", () => {
    expect(companionProblems([all[1]], all)[0]).toMatch(/also needs a discussion/);
    expect(companionProblems([all[1], all[4]], all)).toEqual([]);
  });
  it("falls back to every section when numbering doesn't follow hundreds", () => {
    const odd = [sec(1, "LEC", "001", "RELG 1040"), sec(2, "DIS", "101", "RELG 1040")];
    expect(companionProblems(odd, odd)).toEqual([]);
  });
});

describe("pairing edge cases from real courses", () => {
  const e3020 = [sec(1, "LEC", "100", "ECON 3020"), sec(2, "DIS", "101", "ECON 3020"), sec(3, "LEC", "300", "ECON 3020"), sec(4, "LEC", "400", "ECON 3020"), sec(5, "DIS", "401", "ECON 3020")];
  it("a lecture with no block of its own needs nothing when every block is owned", () => {
    expect(companionProblems([e3020[2]], e3020)).toEqual([]);
  });
  it("flags another lecture's block for an off-pattern lecture", () => {
    const e3010 = [sec(1, "LEC", "091", "ECON 3010"), sec(2, "LEC", "200", "ECON 3010"), sec(3, "DIS", "201", "ECON 3010")];
    expect(companionProblems([e3010[0], e3010[2]], e3010)[0]).toMatch(/belongs to another lecture, and ECON 3010-091/);
  });
  it("flags two lectures of one course and a discussion with no lecture", () => {
    expect(companionProblems([all[0], all[1]], all).some((p) => /in the cart twice/.test(p))).toBe(true);
    expect(companionProblems([all[2]], all)[0]).toMatch(/add its lecture/);
  });
});
