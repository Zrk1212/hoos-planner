/**
 * Which credits count as "College" for the 108-of-120 rule, and which department a subject belongs to
 * (for the Disciplines ≥6-departments rule). Sources: docs/college-gen-ed-rules.md §4 and the
 * College subject-code list. acad_group from SIS wins when we have it.
 */

/** Subjects outside the College that still count as College-equivalent toward the 108 (but NOT for gen-ed). */
const COLLEGE_EQUIVALENT_NOT_GENED = new Set(["CS"]);
/** Explicitly College-equivalent and usable for gen-ed. */
const COLLEGE_EQUIVALENT_GENED = new Set(["ARH", "PHS"]);
/**
 * Course-level exceptions from the Record's Course Rules (docs/college-gen-ed-rules.md §4): these win over the
 * subject lists and over acad_group. ARCH 1010 / MSE 2010 are College-equivalent AND usable for gen-ed;
 * ARCH 1020, STS 3500 and USEM 1580/2580 are College-equivalent but never gen-ed. Every other STS/USEM/ARCH
 * course is non-College.
 */
const COURSE_STATUS: Record<string, CollegeStatus> = {
  "ARCH 1010": "college", "MSE 2010": "college",
  "ARCH 1020": "college-equivalent", "STS 3500": "college-equivalent", "USEM 1580": "college-equivalent", "USEM 2580": "college-equivalent",
};
/** Only this many KLPA/KINE physical-activity credits may be applied toward the degree. */
export const PE_CREDIT_CAP = 2;
/** Explicitly non-College subjects. */
const NON_COLLEGE = new Set([
  "COMM", "CGBM", "ENTP", "GCOM", // McIntire
  "DS", // Data Science
  "KLPA", "KINE", "EDHS", "EDIS", "EDLF", "EDNC", "EDUC", // Education
  "ENGR", "APMA", "ECE", "CE", "MAE", "BME", "CHE", "SYS", "ENVS", "ELA", // Engineering (CS/STS handled above; ENVS as taught in CGAS is College)
  "ARCH", "LAR", "PLAN", "ALAR", "PLAC", "SARC", // Architecture
  "LPPA", "LPPP", "LPPS", "LPPL", // Batten
  "NUCO", "NUIP", "NURS", // Nursing
  "AIRS", "MISC", "NASC", "INST", "PLSK", "SEMS", "UNST", "USEM",
  "STS", // Engineering; only STS 3500 is College-equivalent (COURSE_STATUS)
  "MSE", // Engineering; only MSE 2010 is College (COURSE_STATUS)
]);
// ENVS is taught in the College (Environmental Sciences dept) — remove it from the non-College set.
NON_COLLEGE.delete("ENVS");

export type CollegeStatus = "college" | "college-equivalent" | "non-college";

export function collegeStatus(course: string, acadGroup?: string | null): CollegeStatus {
  const key = course.toUpperCase().replace(/\s+/g, " ").trim();
  const subject = key.split(" ")[0] ?? "";
  const override = COURSE_STATUS[key];
  if (override) return override;
  if (COLLEGE_EQUIVALENT_NOT_GENED.has(subject)) return "college-equivalent";
  if (COLLEGE_EQUIVALENT_GENED.has(subject)) return "college";
  if (acadGroup) {
    if (acadGroup === "CGAS") return "college";
    return NON_COLLEGE.has(subject) || acadGroup !== "CGAS" ? "non-college" : "college";
  }
  if (NON_COLLEGE.has(subject)) return "non-college";
  return "college";
}

export function countsTowardCollege108(course: string, acadGroup?: string | null): boolean {
  return collegeStatus(course, acadGroup) !== "non-college";
}

/**
 * Credit total with the KLPA/KINE physical-activity cap applied (at most PE_CREDIT_CAP credits of activity
 * classes count toward the degree, Record "Maximum Credit Hour Limits"). Used by every credit sum in
 * lib/requirements.ts so the cap is applied in one place.
 */
export function cappedCredits(rows: Array<{ course: string; credits: number }>): number {
  let pe = 0;
  let other = 0;
  for (const r of rows) {
    const c = Number.isFinite(r.credits) ? r.credits : 0;
    if (/^(KLPA|KINE) /.test(r.course.toUpperCase())) pe += c;
    else other += c;
  }
  return other + Math.min(pe, PE_CREDIT_CAP);
}

/** Can a course with this subject satisfy College gen-ed (Disciplines/Literacies) at all? */
export function eligibleForGenEd(course: string, acadGroup?: string | null): boolean {
  return collegeStatus(course, acadGroup) === "college";
}

const DEPT_FAMILIES: Array<[RegExp, string]> = [
  [/^HI(ST|EU|US|AF|EA|LA|ME|SA)$/, "History"],
  [/^REL[GBCHIJS]?$/, "Religious Studies"],
  [/^EN(GL|LT|CW|WR|MC|PG|RN|SP|CR|NC)$/, "English"],
  [/^PL(AP|IR|PT|CP)$/, "Politics"],
  [/^ART[HS]$|^ARAH$|^ARAD$/, "Art"],
  [/^MU(SI|BD|EN|PF)$/, "Music"],
  [/^(SPAN|ITAL|PORT)$/, "Spanish, Italian & Portuguese"],
  [/^(FREN|FRTR)$/, "French"],
  [/^(GERM|GETR)$/, "German"],
  [/^(RUSS|RUTR|SLAV|SLFK|CZ|POL|UKR)$/, "Slavic"],
  [/^(CHIN|JAPN|KOR|CHTR|JPTR|KRTR|EAST)$/, "East Asian"],
  [/^(MEST|ARAB|HEBR|PERS|TURK|HIND|URDU|SANS|SAST|SATR|ARTR|HETR|PETR)$/, "Middle Eastern & South Asian"],
  [/^(CLAS|GREE|LATI)$/, "Classics"],
  [/^(DRAM|DANC)$/, "Drama"],
  [/^(ASTR)$/, "Astronomy"],
  [/^(EVSC|EVGE|EVAT|EVHY|EVEC)$/, "Environmental Sciences"],
  [/^(MATH)$/, "Mathematics"],
  [/^(STAT)$/, "Statistics"],
  [/^(PSYC)$/, "Psychology"],
  [/^(SOC)$/, "Sociology"],
  [/^(ANTH|LNGS|LING)$/, "Anthropology"],
  [/^(ECON)$/, "Economics"],
  [/^(PHIL)$/, "Philosophy"],
  [/^(BIOL)$/, "Biology"],
  [/^(CHEM)$/, "Chemistry"],
  [/^(PHYS)$/, "Physics"],
  [/^(AAS|AMST|WGS|MDST|GSGS|GDS|GSVS|GSMS|GSSJ|GSGS|LASE|JWST|AMEL)$/, "$0"],
];

export function departmentOf(course: string): string {
  const subject = course.split(" ")[0]?.toUpperCase() ?? "";
  for (const [re, name] of DEPT_FAMILIES) {
    if (re.test(subject)) return name === "$0" ? subject : name;
  }
  return subject;
}
