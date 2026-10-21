/**
 * Parse pasted Stellic audit text or SIS unofficial-transcript text into a Profile.
 * No credentials: the user copies text out of their own logged-in session and pastes it here.
 *
 * Handles:
 *  - Stellic rows: "ECON 2010  Principles of Microeconomics  3  A  Fall 2026", status chips
 *    "COMPLETED" / "CURRENTLY TAKING" / "IN PROGRESS" / "PLANNED" / "TRANSFERRED", grade "TE" (transfer equivalent)
 *  - SIS transcript rows: "COMM 1800 Foundations of Commerce 3.000 3.000 A 12.000" under "2026 Fall" headers,
 *    "Test Credits" blocks ("AP Calculus AB 5 ... MATH 1310 Calculus I 4.000")
 *  - AP/IB score lines, language placement ("SPAN 3010P", a placement-diagnostic score, "World Language: satisfied")
 *
 * World Language is only marked satisfied by hard evidence (see `worldLanguageSatisfiedByLine` /
 * `placementCodeSatisfies`): Stellic prints a "World Language Placement Option" heading on every audit and
 * "Not satisfied" lines contain the word "satisfied", so neither may count.
 */
import type { CourseStatus, Profile, ProfileCourse, TestScore } from "./types";

const COURSE_RE = /\b([A-Z]{2,4})\s?-?\s?(\d{4}[A-Z]?)\b/g;
const GRADE_TOKEN = "A\\+|A-|A|B\\+|B-|B|C\\+|C-|C|D\\+|D-|D|F|CR|NC|W|WD|TE|T|IP|S|U|P|INC|NG";
const GRADE_RE = new RegExp(`(?:^|\\s|\\()(${GRADE_TOKEN})(?=\\s|$|\\))`);
const GRADE_RE_G = new RegExp(GRADE_RE.source, "g");
const TERM_RE = /\b(?:(Fall|Spring|Summer|January|J-Term)\s+(20\d{2})|(20\d{2})\s+(Fall|Spring|Summer|January)|(Fall|Spring|Summer|January)(?:\s+Regular Academic Session)?\s+'(\d{2}))\b/i;
/**
 * "AP Calculus AB 5", "AP Biology (5)", "AP Statistics: 5", "AP Physics 1 (5)", "AP Calculus AB 5.00 MATH 1310 …".
 * The exam name may end in a single digit ("Physics 1") when a real score follows; the score must be followed by
 * the end of the line, punctuation, a lowercase word, or an awarded course code so a title digit is never taken.
 */
const AP_RE = /\b(AP|IB(?: HL| SL)?|SAT II|SAT Subject)\s+([A-Za-z&:.'\- ]{1,60}?(?:\s[12])?)\s*[(:]?\s*(?:score\s*)?(\d(?:\.\d+)?)(?=\s*$|\s*[^\s\w]|\s+[A-Z]{2,4} \d{4}|\s+[a-z])/;
/** Language subjects whose "XXXX nnnnP" placement code can satisfy World Language. */
const LANG_SUBJECT_RE = /^(SPAN|FREN|GERM|ITAL|PORT|CHIN|JAPN|KOR|RUSS|ARAB|HEBR|PERS|LATI|GREE|HIND|URDU|TURK|SANS|SWAH|ASL|TBTN|POL|CZ|UKR|PLAD)$/;
const PLACEMENT_CODE_RE = /\b([A-Z]{2,4})\s?(\d{4})P\b/g;
/** Placement diagnostic score at or above this places the student beyond 2020 (observed: Spanish 6.25 → SPAN 3010P). */
const PLACEMENT_DIAGNOSTIC_MIN = 6;
/** The language requirement runs through the 2020 level; placement credit at or above it satisfies the requirement. */
const WORLD_LANGUAGE_DONE_LEVEL = 2020;

const NON_COURSE_SUBJECTS = new Set(["GPA", "CUM", "SAT", "ACT", "AP", "IB", "THE", "AND", "FOR", "UVA", "EDU", "USA",
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "SEPT", "OCT", "NOV", "DEC", "JUNE", "JULY", "TAKEN", "FALL", "ROOM",
  // "CLASS OF 2030", "FA 2026" / "SP 2027" / "SU 2027" / "JA 2027", "TERM 1272", "PAGE 2", "ID 1234"
  "OF", "FA", "SP", "SU", "JA", "WI", "TERM", "YEAR", "PAGE", "ID", "NBR", "SEC", "MIN", "MAX", "TO", "AT", "IN", "ON", "BY", "OR", "IS", "AS"]);
/** Stellic status markers that sit on their own line right before a course code line. */
const STELLIC_STATUS: Array<[RegExp, CourseStatus | "skip"]> = [
  [/^(in progress|currently taking|registered|enrolled)$/i, "in_progress"],
  [/^(taken|completed|complete)$/i, "completed"],
  [/^(planned|cart|waitlisted)$/i, "planned"],
  [/^(remaining|not taken|unsatisfied|needed)$/i, "skip"],
];

const STATUS_WORDS: Array<[RegExp, CourseStatus]> = [
  [/\b(currently taking|in[- ]progress|\bIP\b|enrolled)\b/i, "in_progress"],
  [/\b(planned|plan to take|future)\b/i, "planned"],
  [/\b(transferred|transfer credit|transfer equivalent|\bTE\b)\b/i, "transfer"],
  [/\b(test credit|advanced placement|AP credit|IB credit|exam credit)\b/i, "test"],
  [/\b(completed|complete|taken|satisfied)\b/i, "completed"],
];
/** Grades that mean the attempt did not earn the course (a retake beats these). */
const NON_EARNING_GRADES = new Set(["W", "WD", "F", "NC", "U", "INC", "NG"]);
const SEASON_ORDER: Record<string, number> = { January: 0, Spring: 1, Summer: 2, Fall: 3 };

function normalizeTerm(m: RegExpMatchArray | null): string | undefined {
  if (!m) return undefined;
  const sem = (m[1] ?? m[4] ?? m[5] ?? "").replace(/^J-Term$/i, "January");
  const yr = m[2] ?? m[3] ?? (m[6] ? `20${m[6]}` : undefined);
  return sem && yr ? `${sem[0].toUpperCase()}${sem.slice(1).toLowerCase()} ${yr}` : undefined;
}

/** Sortable key for a normalized term ("Fall 2026" → 20263); -1 when unknown. */
function termKey(term?: string): number {
  const m = term?.match(/^(January|Spring|Summer|Fall) (\d{4})$/);
  return m ? parseInt(m[2], 10) * 10 + (SEASON_ORDER[m[1]] ?? 0) : -1;
}

function defaultCredits(course: string): number {
  if (course.startsWith("EGMT ")) return 2;
  if (/^(KLPA|KINE) /.test(course)) return 1;
  if (/^(MATH 13[12]0|STAT 2120|ECON 2010)$/.test(course)) return course === "ECON 2010" ? 3 : 4;
  return 3;
}

/**
 * Credits from the text of a row. `rest` is the row after the course code, with the term and AP text removed.
 * When the grade position is known, the number nearest before the grade wins ("Elementary Spanish 1 4 A" → 4):
 * a title may contain small integers, the credits sit right before the grade/status.
 */
function pickCredits(rest: string, course: string, gradeIndex?: number): { credits: number; found: boolean } {
  const scan = (text: string): number | null => {
    // explicit "3 credits" / "3.0 cr" / "3 units"
    let m = text.match(/(?<![\d.])(\d{1,2}(?:\.\d{1,3})?)\s*(?:credits?|cr\.?|units?|hrs?)\b/i);
    if (m) return parseFloat(m[1]);
    // decimals like 3.000 (SIS "Attempted") or 3.0 (Stellic)
    m = text.match(/(?<![\d.])(\d{1,2}\.\d{1,3})(?![\d.])/);
    if (m && parseFloat(m[1]) <= 12) return parseFloat(m[1]);
    // lone small integers not part of a year/score context — the last one is the one next to the grade
    const ints = [...text.matchAll(/(?<![\d.:/-])(\d{1,2})(?![\d.:/%-])/g)].map((x) => parseInt(x[1], 10)).filter((n) => n >= 0 && n <= 8);
    return ints.length ? ints[ints.length - 1] : null;
  };
  const beforeGrade = gradeIndex != null && gradeIndex > 0 ? scan(rest.slice(0, gradeIndex)) : null;
  if (beforeGrade != null) return { credits: beforeGrade, found: true };
  const whole = scan(rest.replace(GRADE_RE_G, " "));
  if (whole != null) return { credits: whole, found: true };
  return { credits: defaultCredits(course), found: false };
}

/**
 * The grade token of a row: the LAST grade-looking token, where a single letter only counts when it follows the
 * credits number (or a digit) or sits at the row end, and never when a title word follows it
 * ("MATH 1210 A Survey of Calculus I 3" has no grade).
 */
function pickGrade(text: string): { grade: string; index: number } | null {
  let out: { grade: string; index: number } | null = null;
  const firstDigit = text.search(/\d/);
  for (const m of text.matchAll(GRADE_RE_G)) {
    const tok = m[1];
    const index = m.index! + m[0].length - tok.length;
    if (tok.length === 1) {
      const after = text.slice(index + 1, index + 80);
      if (/^\s+(?:[A-Z][a-z]|[a-z])/.test(after)) continue; // "A Survey of…", "a course"
      const atEnd = /^[\s)]*$/.test(after) || /^[\s)]*[A-Z]{2,}(?:\s|$)/.test(after); // row end or an all-caps status chip
      const afterNumber = firstDigit >= 0 && firstDigit < index;
      if (!atEnd && !afterNumber) continue;
    }
    out = { grade: tok.toUpperCase(), index };
  }
  return out;
}

/**
 * The part of a row where status words are trustworthy: anything after the first digit (credits/grade zone),
 * all-caps chips ("CURRENTLY TAKING"), and the last two words ("… Commerce Enrolled"). Title words like
 * "The Future of Humanity" or "Complete History of Rome" are left out.
 */
function statusZone(rest: string): string {
  const firstDigit = rest.search(/\d/);
  const afterDigit = firstDigit >= 0 ? rest.slice(firstDigit) : "";
  const caps = rest.match(/\b[A-Z]{2,}\b/g)?.join(" ") ?? "";
  // the last one or two purely alphabetic words (a backtracking regex here was quadratic on long lines)
  const toks = rest.trim().split(/\s+/);
  const tailToks: string[] = [];
  for (let i = toks.length - 1; i >= 0 && tailToks.length < 2 && /^[A-Za-z-]+$/.test(toks[i]); i--) tailToks.unshift(toks[i]);
  const tail = tailToks.join(" ");
  return `${afterDigit} | ${caps} | ${tail}`;
}

/** "SPAN 3010P" (placement credit for SPAN 3010): a language placement code at or beyond the 2020 level. */
function placementCodeSatisfies(subject: string, level: string): boolean {
  return LANG_SUBJECT_RE.test(subject) && parseInt(level, 10) >= WORLD_LANGUAGE_DONE_LEVEL;
}

/** A line that says World Language is satisfied/complete/exempt with no negation on the same line. */
function worldLanguageSatisfiedByLine(line: string): boolean {
  if (!/world language/i.test(line)) return false;
  if (!/\b(satisfied|completed?|exempt(?:ed|ion)?)\b/i.test(line)) return false;
  if (/\b(not|never|no)\b|\b(un|in)(?:satisf|complet|met)|\bpending\b/i.test(line)) return false;
  return true;
}

/** Placement-diagnostic score on the same line ("UVWLPD - Spanish Place Diagnostic … 6.25"). */
function placementDiagnosticScore(line: string): number | null {
  if (!/\bplace(?:ment)?\s+(?:diagnostic|exam|test)\b/i.test(line)) return null;
  const m = line.match(/(\d+(?:\.\d+)?)\s*$/);
  return m ? parseFloat(m[1]) : null;
}

interface LineInfo {
  tm: RegExpMatchArray | null;
  isHeaderish: boolean;
  /** "Fall 2026", "2026 Fall", "Currently taking (Fall 2026)" */
  termOnly: boolean;
  /** section header that sets the status context; "none" clears it */
  header: CourseStatus | "none" | null;
}

/** A Stellic record chip, part of the row above it: "CURRENTLY TAKING IN FALL '26", "TRANSFERRED FALL '26". */
function isStellicChip(line: string): boolean {
  return /^[A-Z' \d]+$/.test(line) && /'\d{2}\b/.test(line);
}

function lineInfo(line: string): LineInfo {
  const tm = line.match(TERM_RE);
  const isHeaderish = line.length < 60 && !/[A-Z]{2,4}\s?\d{4}/.test(line.replace(TERM_RE, ""));
  const termOnly = !!tm && line.replace(TERM_RE, "").replace(/[()\-–:|]/g, " ").replace(/\b(term|semester|currently taking|in progress|enrolled|courses?)\b/gi, " ").trim().length <= 3;
  let header: CourseStatus | "none" | null = null;
  if (isHeaderish && !termOnly) {
    if (/transfer credit|test credit|advanced placement|AP\/IB|exam credit|^transferred$/i.test(line)) header = /test|advanced placement|AP|exam/i.test(line) ? "test" : "transfer";
    else if (/in progress|currently taking|current (term|enrollment)|enrolled/i.test(line)) header = "in_progress";
    else if (/planned|plan\b/i.test(line) && !/[A-Z]{2,4} \d{4}/.test(line)) header = "planned";
    else if (/^(completed|complete|earned|satisfied|history)\b/i.test(line)) header = "completed";
    else if (/^(remaining|unsatisfied|not satisfied|still needed|requirements?)\b/i.test(line)) header = "none";
  }
  return { tm, isHeaderish, termOnly, header };
}

export function parseAudit(text: string): Profile {
  // Bound the work per line: audits never have long lines, and regexes below are only safe on short ones.
  // browser copies bring non-breaking spaces; old Macs end lines with a bare \r
  const lines = text.replace(/\r\n?/g, "\n").replace(/[\u00a0\u202f\u2007]/g, " ").replace(/\bAPUSH\b/gi, "AP US History").split("\n").slice(0, 5000).map((l) => l.replace(/\t/g, "  ").trim().slice(0, 400));
  const courses = new Map<string, ProfileCourse>();
  const tests: TestScore[] = [];
  const notes: string[] = [];
  let worldLanguagePlacement = false;
  let program: string | undefined;
  let pathway: Profile["pathway"] = "unknown";
  let sourceFormat: Profile["sourceFormat"] = "unknown";

  if (/stellic|audit|requirements? progress|currently taking/i.test(text)) sourceFormat = "stellic";
  else if (/unofficial transcript|beginning of undergraduate record|attempted\s+earned|test credits/i.test(text)) sourceFormat = "sis-transcript";
  else if (COURSE_RE.test(text)) sourceFormat = "freeform";
  COURSE_RE.lastIndex = 0;
  if (/engagements? pathway|egmt/i.test(text)) pathway = "engagements";
  else if (/disciplines plus/i.test(text)) pathway = "disciplines-plus";
  else if (/echols/i.test(text)) pathway = "echols";
  const prog = text.match(/Program:\s*([^\n]+)/i) ?? text.match(/(Arts (?:&|and) Sciences[^\n]{0,40})/i);
  if (prog) program = prog[1].trim();

  // World Language: only a placement code at/above 2020, a diagnostic score ≥ 6, or an un-negated "satisfied" line.
  for (const l of lines) {
    if (worldLanguageSatisfiedByLine(l)) worldLanguagePlacement = true;
    for (const m of l.matchAll(PLACEMENT_CODE_RE)) if (placementCodeSatisfies(m[1], m[2])) worldLanguagePlacement = true;
    const score = placementDiagnosticScore(l);
    if (score != null && score >= PLACEMENT_DIAGNOSTIC_MIN) worldLanguagePlacement = true;
  }

  let ctxStatus: CourseStatus | null = null; // from section headers
  let ctxTerm: string | undefined;
  const now = new Date();
  const currentTermIsPast = (term?: string) => {
    if (!term) return null;
    const m = term.match(/(Fall|Spring|Summer|January) (\d{4})/);
    if (!m) return null;
    const y = parseInt(m[2], 10);
    const endMonth = { Fall: 12, Spring: 5, Summer: 8, January: 1 }[m[1]] ?? 12;
    const end = new Date(y, endMonth, 0);
    return end < now;
  };

  /**
   * Keep one row per course. A retake beats a W/F/NC attempt (an in-progress retake included); otherwise the
   * better status wins (completed < test/transfer < in progress < planned), then the later term, then a row
   * that carries a grade.
   */
  const upsert = (c: ProfileCourse) => {
    const prev = courses.get(c.course);
    const merged = { ...prev, ...c, credits: c.credits || prev?.credits || defaultCredits(c.course) };
    if (!prev) { courses.set(c.course, merged); return; }
    const rank: Record<CourseStatus, number> = { completed: 0, test: 1, transfer: 1, in_progress: 2, planned: 3 };
    const nonEarning = (r: ProfileCourse) => !!r.grade && NON_EARNING_GRADES.has(r.grade.toUpperCase());
    let replace: boolean;
    if (nonEarning(prev) !== nonEarning(c)) replace = nonEarning(prev);
    else if (rank[c.status] !== rank[prev.status]) replace = rank[c.status] < rank[prev.status];
    else if (termKey(c.term) !== termKey(prev.term)) replace = termKey(c.term) > termKey(prev.term);
    else replace = !prev.grade && !!c.grade;
    if (replace) courses.set(c.course, merged);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // section headers / status context
    const info = lineInfo(line);
    const { tm, isHeaderish, termOnly } = info;
    if (tm && isHeaderish && /graduat|expected|admit|matricul|catalog|entered/i.test(line)) continue;
    if (termOnly) {
      ctxTerm = normalizeTerm(tm);
      const saysCurrent = /currently taking|in progress|enrolled/i.test(line);
      ctxStatus = saysCurrent || currentTermIsPast(ctxTerm) === false ? "in_progress" : null;
      continue;
    }
    if (info.header) {
      ctxStatus = info.header === "none" ? null : info.header;
      ctxTerm = info.header === "in_progress" && tm ? normalizeTerm(tm) : undefined;
      continue;
    }

    // Stellic test-score block: "AP - Biology" then "TAKEN <date>" then the score on its own line
    const stellicTest = line.match(/^(AP|IB|SAT I|SAT II|ACT)\s*-\s*(.+)$/i);
    if (stellicTest && /^TAKEN /i.test(lines[i + 1] ?? "") && /^[\d.]+$/.test(lines[i + 2] ?? "")) {
      const exam = `${stellicTest[1].toUpperCase()} ${stellicTest[2].replace(/^[A-Za-z ]+:\s*/, "").trim()}`;
      if (!tests.some((t) => t.exam.toLowerCase() === exam.toLowerCase())) tests.push({ exam, score: lines[i + 2], awarded: [] });
      i += 2; continue;
    }
    if (/\bplace(?:ment)?\s+(?:diagnostic|exam|test)\b/i.test(line) && /^TAKEN /i.test(lines[i + 1] ?? "") && parseFloat(lines[i + 2] ?? "0") >= PLACEMENT_DIAGNOSTIC_MIN) worldLanguagePlacement = true;
    // AP / IB score lines
    const ap = line.match(AP_RE);
    if (ap && !/\b[A-Z]{2,4} \d{4}[A-Z]?\b.*\b[A-Z]{2,4} \d{4}/.test(line)) {
      const exam = `${ap[1]} ${ap[2].trim()}`.replace(/\s+/g, " ");
      const score = String(parseFloat(ap[3]));
      if (!tests.some((t) => t.exam.toLowerCase() === exam.toLowerCase())) tests.push({ exam, score, awarded: [] });
      // SIS test-credit rows carry the awarded course on the same line or the next
      const nextLooksAwarded = (l?: string) => !!l && /\b[A-Z]{2,4} \d{4}/.test(l) && !AP_RE.test(l) && !/placement|language|exempt/i.test(l);
      const awardedLine = /\b[A-Z]{2,4} \d{4}/.test(line) ? line : (nextLooksAwarded(lines[i + 1]) ? lines[i + 1] : null);
      if (awardedLine) {
        for (const m of awardedLine.matchAll(COURSE_RE)) {
          if (NON_COURSE_SUBJECTS.has(m[1])) continue;
          const course = `${m[1]} ${m[2]}`;
          if (/\d{4}P$/.test(course)) continue; // placement placeholder, not credit
          tests[tests.length - 1].awarded!.push(course);
          const rest = awardedLine.slice(m.index! + m[0].length);
          const { credits } = pickCredits(rest, course);
          upsert({ course, credits, status: "test", grade: "T", generic: /\d{4}T$/.test(course), source: "test-credit", term: ctxTerm });
        }
        if (awardedLine !== line) i++;
      }
      if (!awardedLine) {
        for (const c of apEquivalents(exam, score)) upsert({ ...c, status: "test", grade: "T", source: "ap-table" });
      }
      continue;
    }

    // course rows (one or more course codes per line)
    const matches = [...line.matchAll(COURSE_RE)].filter((m) => !NON_COURSE_SUBJECTS.has(m[1]));
    if (!matches.length) continue;
    if (/placement credit for/i.test(line)) continue;
    // requirement descriptions like "One of: ECON 2010 or ECON 2020" are not records
    if (matches.length > 1 && /\bor\b|one of|any of|choose|select|from:|options?/i.test(line) && !/\d\.\d{3}|[A-F][+-]?\s|completed|taking|transferred/i.test(line)) continue;
    let used = 0;
    let fullLine = line;
    let blockStatus: CourseStatus | "skip" | null = null;
    let forced: CourseStatus | null = null;
    const bareCode = /^[A-Z]{2,4}\s?\d{4}[A-Z]?\s*$/.test(line);
    // a condensed Stellic row keeps its status word in front: "Remaining EGMT 1530 Engaging Differences 2 CREDITS"
    const lead = bareCode ? null : line.match(/^(remaining|not taken|unsatisfied|needed|in progress|currently taking|registered|enrolled|taken|completed|complete|planned|cart|waitlisted)\b/i);
    if (lead) {
      const st = STELLIC_STATUS.find(([re]) => re.test(lead[1]))?.[1];
      if (st === "skip") continue;
      if (st) forced = st;
    }
    if (bareCode) {
      // Stellic layout: [status line] / CODE / title / "N CREDITS" / "CURRENTLY TAKING IN FALL '26" | "TRANSFERRED FALL '26" / grade
      if (/\d{4}P\s*$/.test(line)) continue; // placement placeholder block (World Language handled above)
      const prev = lines[i - 1] ?? "";
      for (const [re, st] of STELLIC_STATUS) if (re.test(prev)) { blockStatus = st; break; }
      for (let k = 1; k <= 6 && i + k < lines.length; k++) {
        const nxt = lines[i + k];
        if (!nxt) break;
        if (/^[A-Z]{2,4}\s?\d{4}[A-Z]?\s*$/.test(nxt) || STELLIC_STATUS.some(([re]) => re.test(nxt)) || /^\d{2} Remaining$|^Total |^Test Scores|^\w+ \d{4}\s*$/.test(nxt)) break;
        const ni = lineInfo(nxt);
        // the first line under a bare code is its title (e.g. "Non-UVa Transfer/Test Credit"), never a header
        if ((ni.termOnly && !isStellicChip(nxt)) || (k > 1 && ni.header && !/\d/.test(nxt))) break;
        fullLine += "  " + nxt; used = k;
      }
      if (blockStatus === "skip") { i += used; continue; }
      forced = blockStatus;
    } else if (matches.length === 1) {
      // Stellic/other wraps: pull in up to two following lines that carry no course code — never a term-only
      // line ("2026 Fall") or a section header, which belong to the rows after them
      for (let k = 1; k <= 2 && i + k < lines.length; k++) {
        const nxt = lines[i + k];
        if (!nxt || [...nxt.matchAll(COURSE_RE)].some((x) => !NON_COURSE_SUBJECTS.has(x[1])) || AP_RE.test(nxt)) break;
        const ni = lineInfo(nxt);
        if ((ni.termOnly && !isStellicChip(nxt)) || ni.header) break;
        if (/\d|completed|taking|progress|planned|transferred|\bTE\b/i.test(nxt) && nxt.length < 80) { fullLine += "  " + nxt; used = k; }
        else break;
      }
    }
    const segs = [...fullLine.matchAll(COURSE_RE)].filter((m) => !NON_COURSE_SUBJECTS.has(m[1]));
    for (let si = 0; si < segs.length; si++) {
      const m = segs[si];
      const course = `${m[1]} ${m[2]}`;
      if (/\d{4}P$/.test(course)) continue; // placement code, handled above
      const segEnd = si + 1 < segs.length ? segs[si + 1].index! : fullLine.length;
      const rest = fullLine.slice(m.index! + m[0].length, segEnd);
      const before = fullLine.slice(Math.max(0, (si > 0 ? segs[si - 1].index! + segs[si - 1][0].length : 0)), m.index!).slice(-40);
      if (/not (yet )?(satisfied|met|complete|taken)|unsatisfied|still needed|remaining|incomplete|missing|no course|needs?\b/i.test(rest) && !pickGrade(rest.replace(TERM_RE, " "))) continue;
      const multi = segs.length > 1;
      const restCore = multi ? rest.split(/[,;]|\s+and\s+/)[0] : rest;
      const beforeCore = multi ? before.split(/[,;]|\s+and\s+/).pop() ?? "" : "";
      const restNoTerm = restCore.replace(TERM_RE, " ");
      const term = normalizeTerm(rest.match(TERM_RE) ?? before.match(TERM_RE)) ?? ctxTerm;
      const zone = statusZone(restCore);

      let status: CourseStatus | null = forced;
      // transfer/test evidence inside the row beats a generic "Taken" marker
      if (/transferred|\bTE\b/i.test(zone)) status = /AP|IB|advanced placement|test credit|\d{4}T\b/i.test(restCore) ? "test" : "transfer";
      if (!status) for (const [re, st] of STATUS_WORDS) if (re.test(zone) || (multi && re.test(beforeCore))) { status = st; break; }
      const g = pickGrade(restNoTerm);
      let grade = g?.grade;
      if (grade === "TE" || grade === "T") { status = status ?? (ctxStatus === "test" ? "test" : "transfer"); }
      if (grade === "IP") { status = "in_progress"; grade = undefined; }
      const letter = grade && /^[A-F][+-]?$|^(CR|NC|W|WD|S|U|P)$/.test(grade);
      if (letter && (status === null || status === "in_progress")) status = "completed";
      if (!status) status = ctxStatus ?? (currentTermIsPast(term) === false ? "in_progress" : (grade ? "completed" : "in_progress"));
      if (status === "transfer" && /AP|IB|advanced placement|test/i.test(restCore)) status = "test";
      if (status === "completed" && !grade && currentTermIsPast(term) === false) status = "in_progress";
      const creditsText = restNoTerm.replace(AP_RE, " ").split(/\.\s/)[0];
      const { credits } = pickCredits(creditsText, course, g && g.index < creditsText.length ? g.index : undefined);
      const titleMatch = restNoTerm.match(/^\s*[-–:]?\s*([A-Za-z][^\d]{3,80}?)(?=\s{2,}|\s\d|\s[A-F][+-]?\b|$)/);
      upsert({
        course, title: titleMatch?.[1]?.trim(), credits, grade: grade && grade !== "T" && grade !== "TE" ? grade : (status === "test" || status === "transfer" ? "T" : undefined),
        status, term, generic: /\d{4}T$/.test(course), source: sourceFormat,
      });
    }
    if (ap) {
      const exam = `${ap[1]} ${ap[2].trim()}`.replace(/\s+/g, " ");
      if (!tests.some((t) => t.exam.toLowerCase() === exam.toLowerCase())) tests.push({ exam, score: String(parseFloat(ap[3])), awarded: [] });
    }
    i += used;
  }

  // AP exams listed without awarded courses → map via table when the course isn't already present
  for (const t of tests) {
    if (t.awarded?.length) continue;
    for (const c of apEquivalents(t.exam, t.score)) {
      if (!courses.has(c.course)) upsert({ ...c, status: "test", grade: "T", source: "ap-table" });
      t.awarded!.push(c.course);
    }
  }

  if (!courses.size) notes.push("No course rows recognised. Paste the full audit or transcript text, one course per line.");
  if (sourceFormat === "freeform") notes.push("Parsed as free-form text; check statuses below.");

  return {
    courses: [...courses.values()].sort((a, b) => a.course.localeCompare(b.course)),
    tests, worldLanguagePlacement, program, pathway, notes, parsedAt: new Date().toISOString(), sourceFormat,
  };
}

/**
 * UVA AP credit table (subset). Rows marked [M5] follow docs/mcintire-admission.md §5 (UVA credit chart [S17]):
 * Micro/Macro 5 → ECON 2010/2020, 4 → ECON 1000T (elective credit that satisfies neither ECON 2010 nor SES);
 * Statistics 5 → STAT 2120, 4 → STAT 1120; Calculus AB 4/5 → MATH 1310, BC 4/5 → MATH 1310 + 1320;
 * English Language/Literature 4/5 → ENGL 1000T (non-equivalent). The rest come from docs/planning-brief.md §1a.
 */
export function apEquivalents(exam: string, score: string): ProfileCourse[] {
  const s = parseInt(score, 10);
  // students type short names ("AP Calc BC 5", "AP Lang", "APUSH"): expand them to the College Board titles
  const e = exam.toLowerCase().replace(/^(ap|ib(?: hl| sl)?)\s+/, "")
    .replace(/\bcalc\b/g, "calculus").replace(/\bbio\b/g, "biology").replace(/\bchem\b/g, "chemistry").replace(/\bpsych\b/g, "psychology")
    .replace(/\bstats?\b/g, "statistics").replace(/\bapush\b|\bush\b/g, "u.s. history").replace(/\beuro\b/g, "european history")
    .replace(/\bcsa\b|\bcs a\b/g, "computer science a").replace(/\bcsp\b|\bcs principles\b/g, "computer science principles")
    .replace(/^(english )?lang(uage)?( and comp(osition)?)?$/, "english language").replace(/^(english )?lit(erature)?( and comp(osition)?)?$/, "english literature")
    .replace(/\bwhap\b|\bworld\b(?! language)/g, "world history").replace(/\bmicroecon(omics)?\b/g, "micro").replace(/\bmacroecon(omics)?\b/g, "macro");
  const c = (course: string, credits: number, generic = false): ProfileCourse => ({ course, credits, status: "test", generic });
  if (/calculus ab/.test(e) && s >= 4) return [c("MATH 1310", 4)]; // [M5]
  if (/calculus bc/.test(e) && s >= 4) return [c("MATH 1310", 4), c("MATH 1320", 4)]; // [M5]
  if (/biology/.test(e) && s >= 4) return [c("BIOL 2100", 4), c("BIOL 2200", 4)];
  if (/macro/.test(e)) { // [M5]
    if (s >= 5) return [c("ECON 2020", 3)];
    if (s === 4) return [c("ECON 1000T", 3, true)];
    return [];
  }
  if (/micro/.test(e)) { // [M5]
    if (s >= 5) return [c("ECON 2010", 3)];
    if (s === 4) return [c("ECON 1000T", 3, true)];
    return [];
  }
  if (/computer science principles/.test(e) && s >= 4) return [c("CS 1000T", 3, true)];
  if (/computer science a\b/.test(e) && s >= 4) return [c("CS 1110", 3)];
  if (/u\.?s\.? history|united states history/.test(e) && s >= 4) return [c("HIST 1000T", 3, true)];
  if (/(u\.?s\.? )?gov/.test(e) && s >= 4) return [c("PLAP 1000T", 3, true)];
  if (/statistics/.test(e)) { // [M5]
    if (s >= 5) return [c("STAT 2120", 4)];
    if (s === 4) return [c("STAT 1120", 3)];
    return [];
  }
  if (/chemistry/.test(e) && s >= 4) return [c("CHEM 1410", 3), c("CHEM 1420", 3)];
  if (/physics c: mech|physics c mech/.test(e) && s >= 4) return [c("PHYS 1425", 3)];
  if (/english (language|literature)/.test(e) && s >= 4) return [c("ENGL 1000T", 3, true)]; // [M5]
  if (/psychology/.test(e) && s >= 4) return [c("PSYC 1000T", 3, true)];
  if (/world history|european history/.test(e) && s >= 4) return [c("HIST 1000T", 3, true)];
  if (/environmental/.test(e) && s >= 4) return [c("EVSC 1000T", 3, true)];
  if (/human geography/.test(e) && s >= 4) return [c("GEOG 1000T", 3, true)];
  return [];
}

export function profileSummary(p: Profile): string {
  const by = (s: CourseStatus) => p.courses.filter((c) => c.status === s);
  const fmt = (c: ProfileCourse) => `${c.course}${c.grade ? ` (${c.grade})` : ""}${c.credits ? ` ${c.credits}cr` : ""}`;
  return [
    `Completed: ${by("completed").map(fmt).join(", ") || "none"}`,
    `In progress: ${by("in_progress").map(fmt).join(", ") || "none"}`,
    `Test/transfer credit: ${[...by("test"), ...by("transfer")].map(fmt).join(", ") || "none"}`,
    p.tests.length ? `Exams: ${p.tests.map((t) => `${t.exam} ${t.score}`).join(", ")}` : "",
    p.worldLanguagePlacement ? "World Language: satisfied by placement" : "",
  ].filter(Boolean).join("\n");
}
