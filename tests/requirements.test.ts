import { describe, expect, it } from "vitest";
import { parseAudit } from "@/lib/audit-parser";
import { cappedCredits, collegeStatus, eligibleForGenEd } from "@/lib/college";
import { evaluate, whatItSatisfies } from "@/lib/requirements";
import type { Profile, ProfileCourse, Section } from "@/lib/types";
import { fromSeedMeet } from "@/lib/meetings";
import { STELLIC_SAMPLE } from "./fixtures";

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

describe("requirements – the sample student after fall 2026", () => {
  const profile = parseAudit(STELLIC_SAMPLE);
  const st = evaluate({ profile });

  it("engagements: 1510 done, 1520 in progress, 1530/1540 remaining", () => {
    const by = Object.fromEntries(st.engagements.areas.map((a) => [a.nbr, a.item.status]));
    expect(by).toEqual({ "1510": "done", "1520": "in_progress", "1530": "missing", "1540": "missing" });
    expect(st.engagements.remaining).toEqual(["1530", "1540"]);
  });
  it("literacies: FWR in progress, WL by placement, QCD 1 of 2, SWR missing", () => {
    expect(st.literacies.fwr.status).toBe("in_progress");
    expect(st.literacies.worldLanguage.status).toBe("done");
    expect(st.literacies.qcd.courses.map((c) => c.course)).toEqual(["MATH 1310"]);
    expect(st.literacies.qcd.item.status).toBe("missing");
    expect(st.literacies.swr.status).toBe("missing");
  });
  it("disciplines: LS via BIOL 2200, SES via ECON (one of 2010/2020), five still owed", () => {
    const by = Object.fromEntries(st.disciplines.areas.map((a) => [a.code, a.item]));
    expect(by.LS.status).toBe("done");
    expect(by.LS.by).toMatch(/BIOL 2[12]00/);
    expect(["done", "in_progress"]).toContain(by.SES.status);
    expect(st.disciplines.unmet.sort()).toEqual(["AIP", "CMP", "CSW", "HP", "SS"]);
    expect(st.disciplines.departments.sort()).toEqual(["Biology", "Economics"]);
  });
  it("credits: 24 test + 2 earned + 14 in progress; 6 non-College so far", () => {
    expect(st.credits.test).toBe(24);
    expect(st.credits.earned).toBe(26);
    expect(st.credits.inProgress).toBe(14);
    expect(st.credits.nonCollege).toBe(6);
    expect(st.credits.projected).toBe(40);
  });
  it("McIntire: all three prereqs in progress, graded credits projected ≥ 24 only after spring", () => {
    expect(st.mcintire.comm1800.status).toBe("in_progress");
    expect(st.mcintire.econ2010.status).toBe("in_progress");
    expect(st.mcintire.fwr.status).toBe("in_progress");
    expect(st.mcintire.gradedUvaCredits.projected).toBe(16);
    expect(st.mcintire.ready).toBe(false);
  });
  it("SDS: DS 1001 and programming missing; AP CS Principles flagged", () => {
    expect(st.sds.ds1001.status).toBe("missing");
    expect(st.sds.programming.status).toBe("missing");
    expect(st.sds.notes.join(" ")).toMatch(/Principles/);
  });
});

describe("requirements – with the spring cart", () => {
  const profile = parseAudit(STELLIC_SAMPLE);
  const cart: Section[] = [
    sec({ course: "KLPA 1105", class_nbr: 18012, units: "1", units_min: 1, units_max: 1, grading_basis: "Credit/No Credit", acad_group: "EDUC", meetings: fromSeedMeet("TuTh 12.30-13.45", "2027-01-20", "2027-05-04") }),
    sec({ course: "DS 1001", class_nbr: 14401, acad_group: "DSCI" }),
    sec({ course: "DS 1002", class_nbr: 14431, acad_group: "DSCI", meetings: fromSeedMeet("MoWe 15.30-16.45", "2027-01-20", "2027-05-04") }),
    sec({ course: "EGMT 1540", class_nbr: 20843, units: "2", units_min: 2, units_max: 2, start_dt: "2027-01-20", end_dt: "2027-03-16", meetings: fromSeedMeet("TuTh 14.00-15.15", "2027-01-20", "2027-03-16") }),
    sec({ course: "EGMT 1530", class_nbr: 13525, units: "2", units_min: 2, units_max: 2, start_dt: "2027-03-17", end_dt: "2027-05-04", meetings: fromSeedMeet("MoWe 12.30-13.45", "2027-03-17", "2027-05-04") }),
    sec({ course: "MUSI 2072", class_nbr: 13965, attrs: ["ASUD-AIP", "ASUD-HP", "ASUR-R21C2"], meetings: fromSeedMeet("MoWeFr 11.00-11.50", "2027-01-20", "2027-05-04") }),
  ];
  const st = evaluate({ profile, planned: cart, plannedTermName: "Spring 2027" });

  it("engagements all covered", () => {
    expect(st.engagements.remaining).toEqual([]);
    expect(st.engagements.areas.find((a) => a.nbr === "1530")!.item.status).toBe("planned");
    expect(st.engagements.warnings).toEqual([]);
  });
  it("MUSI 2072 counts for ONE discipline and Second Writing", () => {
    const aip = st.disciplines.areas.find((a) => a.code === "AIP")!;
    const hp = st.disciplines.areas.find((a) => a.code === "HP")!;
    expect([aip.item.status, hp.item.status].filter((s) => s === "planned")).toHaveLength(1);
    expect(st.disciplines.alternatives["MUSI 2072"]).toEqual(["AIP", "HP"]);
    expect(st.literacies.swr.status).toBe("planned");
  });
  it("credits: 14 planned, 13 non-College, McIntire 24 graded reached, SDS ready", () => {
    expect(st.credits.planned).toBe(14);
    expect(st.credits.nonCollege).toBe(13);
    expect(st.warnings.join(" ")).toMatch(/non-College/);
    expect(st.mcintire.gradedUvaCredits.projected).toBe(29); // 16 + 14 - 1 CR/NC
    expect(st.mcintire.ready).toBe(true);
    expect(st.sds.ds1001.status).toBe("planned");
    expect(st.sds.programming.by).toBe("DS 1002");
    expect(st.sds.ready).toBe(true);
  });
  it("three Engagements in one term triggers the cap warning", () => {
    const st3 = evaluate({ profile, planned: [...cart, sec({ course: "EGMT 1520", class_nbr: 1, units: "2", units_min: 2, units_max: 2 })] });
    expect(st3.engagements.warnings.join(" ")).toMatch(/2 per semester/);
  });
  it("whatItSatisfies labels", () => {
    expect(whatItSatisfies(sec({ course: "RELB 2900", class_nbr: 2, attrs: ["ASUD-AIP", "ASUD-CSW"] }), st)[0]).toMatch(/Discipline: AIP/);
    expect(whatItSatisfies(sec({ course: "DS 1001", class_nbr: 3, acad_group: "DSCI" }), st)[0]).toMatch(/non-College/);
    expect(whatItSatisfies(sec({ course: "STAT 2120", class_nbr: 4, attrs: ["ASUQ-QCD"], units_max: 4 }), st).join()).toMatch(/QCD/);
  });
});

describe("requirements – department rule", () => {
  it("warns when all seven disciplines come from fewer than six departments", () => {
    const profile = parseAudit(`
HIEU 2041 Roman Republic 3 A Fall 2025 COMPLETED
HIEU 2102 Modern Jewish History 3 A Fall 2025 COMPLETED
HIUS 2051 War and America 3 A Fall 2025 COMPLETED
PHIL 1330 Virtual Worlds 3 A Fall 2025 COMPLETED
PSYC 2700 Child Psych 3 A Fall 2025 COMPLETED
MATH 2310 Calc III 4 A Fall 2025 COMPLETED
PHIL 1740 Life and Death 3 A Fall 2025 COMPLETED
`);
    const st = evaluate({ profile });
    expect(st.disciplines.unmet).toEqual([]);
    expect(st.disciplines.warnings.join(" ")).toMatch(/departments|department/);
  });
});

const done = (course: string, credits = 3, grade = "A", extra: Partial<ProfileCourse> = {}): ProfileCourse => ({ course, credits, grade, status: "completed", term: "Fall 2025", ...extra });
const prof = (courses: ProfileCourse[], tests: Profile["tests"] = []): Profile => ({ courses, tests, worldLanguagePlacement: false, notes: [], parsedAt: "", sourceFormat: "freeform" });

describe("requirements – cart rows carry their own section attrs (C2)", () => {
  it("an HP-only section of a course whose other section is AIP+SWR does not plan SWR", () => {
    const attrIndex = { "MUSI 2072": ["ASUD-AIP", "ASUD-HP", "ASUR-R21C2"] }; // merged over both sections
    const hpOnly = sec({ course: "MUSI 2072", class_nbr: 2, attrs: ["ASUD-HP"] });
    const st = evaluate({ profile: prof([]), attrIndex, planned: [hpOnly] });
    expect(st.literacies.swr.status).toBe("missing");
    expect(st.disciplines.areas.find((a) => a.code === "HP")!.item.status).toBe("planned");
    expect(st.disciplines.areas.find((a) => a.code === "AIP")!.item.status).toBe("missing");
    const both = sec({ course: "MUSI 2072", class_nbr: 1, attrs: ["ASUD-AIP", "ASUR-R21C2"] });
    expect(evaluate({ profile: prof([]), attrIndex, planned: [both] }).literacies.swr.status).toBe("planned");
  });
});

describe("requirements – McIntire prerequisites need a graded basis (C6)", () => {
  it("CR/NC or S/U rows do not satisfy COMM 1800 / ECON 2010 / FWR", () => {
    const st = evaluate({ profile: prof([done("COMM 1800", 3, "CR"), done("ECON 2010", 3, "S"), done("ENWR 1510", 3, "CR")]) });
    expect(st.mcintire.comm1800.status).toBe("missing");
    expect(st.mcintire.comm1800.note).toMatch(/letter grade/);
    expect(st.mcintire.econ2010.status).toBe("missing");
    expect(st.mcintire.fwr.status).toBe("missing");
    const ok = evaluate({ profile: prof([done("COMM 1800"), done("ECON 2010"), done("ENWR 1510")]) });
    expect([ok.mcintire.comm1800.status, ok.mcintire.econ2010.status, ok.mcintire.fwr.status]).toEqual(["done", "done", "done"]);
  });
});

describe("requirements – variable-unit and empty-unit sections (C7)", () => {
  it("counts units_min and notes the variable range; empty units give 0", () => {
    const vari = sec({ course: "MUSI 3390", class_nbr: 5, units: "1 - 12", units_min: 1, units_max: 12 });
    const st = evaluate({ profile: prof([]), planned: [vari, sec({ course: "ECON 2010", class_nbr: 6 })] });
    expect(st.credits.planned).toBe(4);
    expect(st.warnings.join(" ")).toMatch(/variable units/);
    const empty = sec({ course: "XYZ 1000", class_nbr: 7, units: "", units_min: null, units_max: null });
    const st2 = evaluate({ profile: prof([]), planned: [empty] });
    expect(st2.credits.planned).toBe(0);
    expect(Number.isNaN(st2.credits.projected)).toBe(false);
  });
});

describe("requirements – First Writing stretch sequences (C8)", () => {
  it("one half is in progress at best; both halves are done", () => {
    const one = evaluate({ profile: prof([done("ENWR 1505")]) });
    expect(one.literacies.fwr.status).toBe("in_progress");
    expect(one.literacies.fwr.note).toMatch(/ENWR 1506/);
    const both = evaluate({ profile: prof([done("ENWR 1507"), done("ENWR 1508")]) });
    expect(both.literacies.fwr).toMatchObject({ status: "done", by: "ENWR 1507 + ENWR 1508" });
    const halfIp = evaluate({ profile: prof([done("ENWR 1505"), { course: "ENWR 1506", credits: 3, status: "in_progress" }]) });
    expect(halfIp.literacies.fwr.status).toBe("in_progress");
  });
  it("only the course used for FWR is barred from the Disciplines", () => {
    const attrIndex = { "ENLT 2511": ["ASUR-R21C1", "ASUD-AIP"] }; // a First Writing Advanced course that also carries AIP
    const st = evaluate({ profile: prof([done("ENWR 1510"), done("ENLT 2511")]), attrIndex });
    expect(st.literacies.fwr).toMatchObject({ status: "done", by: "ENWR 1510" });
    expect(st.disciplines.areas.find((a) => a.code === "AIP")!.item).toMatchObject({ status: "done", by: "ENLT 2511" });
  });
});

describe("requirements – status-ordered discipline matching (C9)", () => {
  it("done courses are matched before planned ones", () => {
    const attrIndex = { "W 1000": ["ASUD-HP"], "Y 1000": ["ASUD-AIP"], "X 1000": ["ASUD-AIP", "ASUD-HP"] };
    const st = evaluate({ profile: prof([done("W 1000"), done("X 1000")]), attrIndex, planned: [sec({ course: "Y 1000", class_nbr: 9, attrs: ["ASUD-AIP"] })] });
    const by = Object.fromEntries(st.disciplines.areas.map((a) => [a.code, a.item]));
    expect(by.AIP).toMatchObject({ status: "done", by: "X 1000" });
    expect(by.HP).toMatchObject({ status: "done", by: "W 1000" });
  });
});

describe("requirements – S/U and CR/NC (C12)", () => {
  it("S and P earn credit but are not a graded basis; S/U sections satisfy no gen-ed", () => {
    const st = evaluate({ profile: prof([done("ECON 2010", 3, "S"), done("SOC 1010", 3, "P")]) });
    expect(st.credits.earned).toBe(6);
    expect(st.credits.uvaGraded).toBe(0);
    expect(st.disciplines.areas.find((a) => a.code === "SES")!.item.status).toBe("missing");
    expect(whatItSatisfies(sec({ course: "SOC 1010", class_nbr: 1, attrs: ["ASUD-SES"], grading_basis: "Satisfactory/Unsatisfactory" }), st)).toContain("CR/NC: no gen-ed credit");
    expect(whatItSatisfies(sec({ course: "SOC 1010", class_nbr: 1, attrs: ["ASUD-SES"], grading_basis: "Credit/No Credit" }), st)).toContain("CR/NC: no gen-ed credit");
    expect(whatItSatisfies(sec({ course: "SOC 1010", class_nbr: 1, attrs: ["ASUD-SES"], grading_basis: "Student Option" }), st)[0]).toMatch(/Discipline: SES/);
  });
});

describe("requirements – small items", () => {
  it("a cart course already in progress is not double-counted", () => {
    const st = evaluate({ profile: prof([{ course: "ECON 2010", credits: 3, status: "in_progress", term: "Fall 2026" }]), planned: [sec({ course: "ECON 2010", class_nbr: 1 })] });
    expect(st.credits.projected).toBe(3);
    expect(st.warnings.join(" ")).toMatch(/already in progress/);
  });
  it("3-letter language subjects satisfy World Language through 2020", () => {
    expect(evaluate({ profile: prof([done("KOR 2020", 4)]) }).literacies.worldLanguage).toMatchObject({ status: "done", by: "KOR 2020" });
    expect(evaluate({ profile: prof([done("CZ 2020", 4)]) }).literacies.worldLanguage.status).toBe("done");
  });
  it("IB SL Computer Science does not meet the SDS programming requirement; HL 5+ does", () => {
    expect(evaluate({ profile: prof([], [{ exam: "IB SL Computer Science", score: "7" }]) }).sds.programming.status).toBe("missing");
    expect(evaluate({ profile: prof([], [{ exam: "IB HL Computer Science", score: "6" }]) }).sds.programming.status).toBe("done");
  });
  it("two cart sections of one Engagement area are flagged as spares", () => {
    const st = evaluate({ profile: prof([]), planned: [sec({ course: "EGMT 1540", class_nbr: 1, units: "2", units_min: 2, units_max: 2 }), sec({ course: "EGMT 1540", class_nbr: 2, units: "2", units_min: 2, units_max: 2 })] });
    expect(st.engagements.warnings.join(" ")).toMatch(/spare/);
    expect(st.engagements.warnings.join(" ")).not.toMatch(/2 per semester/);
  });
  it("KLPA/KINE credits are capped at 2 toward the degree", () => {
    const st = evaluate({ profile: prof([done("KLPA 1105", 1, "CR"), done("KLPA 1150", 1, "CR"), done("KINE 1160", 1, "CR"), done("ECON 2010")]) });
    expect(st.credits.earned).toBe(5);
    expect(cappedCredits([{ course: "KLPA 1105", credits: 1 }, { course: "KLPA 1150", credits: 1 }, { course: "KLPA 1160", credits: 1 }])).toBe(2);
  });
});

describe("college – course-level exceptions", () => {
  it("USEM 1580/2580, ARCH 1020 and STS 3500 are College-equivalent (no gen-ed); ARCH 1010 and MSE 2010 are College", () => {
    expect(collegeStatus("USEM 1580")).toBe("college-equivalent");
    expect(collegeStatus("USEM 2580")).toBe("college-equivalent");
    expect(collegeStatus("USEM 1570")).toBe("non-college");
    expect(collegeStatus("ARCH 1020")).toBe("college-equivalent");
    expect(collegeStatus("STS 3500")).toBe("college-equivalent");
    expect(collegeStatus("STS 2500")).toBe("non-college");
    expect(collegeStatus("ARCH 1010", "ARCH")).toBe("college");
    expect(collegeStatus("MSE 2010", "ENGR")).toBe("college");
    expect(eligibleForGenEd("ARCH 1010")).toBe(true);
    expect(eligibleForGenEd("USEM 1580")).toBe(false);
  });
});
