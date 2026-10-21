/**
 * Hoos Planner MCP tools. One registration function, two transports:
 *   - app/api/mcp/route.ts  (remote Streamable HTTP, for claude.ai custom connectors / Claude Code / Desktop)
 *   - scripts/mcp-stdio.ts  (local stdio, for Claude Code / Claude Desktop on a laptop that has .env.local)
 *
 * Stateless by design: the client keeps the profile + cart in the conversation (or in a plan code via
 * save_plan / load_plan). Nothing here talks to SIS; everything reads the nightly snapshot in Supabase.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { parseAudit, profileSummary } from "../audit-parser";
import { DEFAULT_TERM, loadCatalog, type Catalog } from "../catalog";
import { findConflicts, sectionsConflict } from "../meetings";
import { buildAcadGroupIndex, buildAttrIndex, evaluate, whatItSatisfies, type RequirementStatus } from "../requirements";
import { cartCredits, companionProblems, companionSections, describeSection, enrollOrder, isSub, searchSections } from "../search";
import { planStore, planUrl, type SaveResult } from "../plans";
import { BackupsSchema, CartSchema, GoalsSchema, PlanCode, ProfileSchema, buildCart, cleanText, normCourse, toProfile, type PlanCartItem, type PlanRow } from "../plan-schema";
import type { DayCode, Profile, Section } from "../types";

export const SERVER_INFO = { name: "hoos-planner", version: "0.2.0" };

/**
 * Server instructions. The remote endpoint has only the snapshot tools; the local stdio server may add live_*
 * tools, so the "never live SIS" sentence is only true in the first case — compose rather than hard-code it.
 */
export function buildInstructions(opts: { live?: boolean } = {}): string {
  const data = opts.live
    ? `Data = a nightly snapshot of the public SIS class search for the current term plus theCourseForum ratings, and live_* tools that read the student's own SIS and Stellic through their signed-in Chrome on this computer (no credentials are stored; NetBadge happens in the browser). Enrollment itself stays manual: live tools may at most edit the SIS shopping cart, behind an explicit confirmation; the student presses Enroll in SIS.`
    : `Data = a nightly snapshot of the public SIS class search for the current term plus theCourseForum ratings; never live SIS, never NetBadge. Enrollment stays manual: give the student 5-digit class numbers to paste into SIS "Add by class number".`;
  return `Hoos Planner: course-planning tools for College of Arts & Sciences undergraduates (Engagements Pathway) who may apply to McIntire or the School of Data Science. ${data}

Workflow: (1) if the student pastes a Stellic audit or SIS transcript, call parse_audit and keep the returned profile JSON for later calls; (2) use search_sections with their constraints (earliest start, days, attrs like AIP/SWR/QCD, engagement area, quarter) and pass cart=[...] with avoid_conflicts=true so results already fit; (3) check_conflicts before recommending a combination; (4) requirement_status(profile, cart) before claiming something fills a requirement; (5) show it on the website: the student watches their plan at hoosplanner.zrk.ventures. If they gave you a plan code (20 letters and digits from the website), pass it as code on EVERY save_plan call, including the first; that page is already open and fills in as you save. Otherwise call save_plan without a code once there is a draft and give them the link it returns. Call save_plan after every change to the cart, backups, goals or profile, always with the same code, so their Schedule, Cart and Requirements pages update by themselves. Never tell the student the plan is on the site without having called save_plan. If a code they paste isn't 20 characters of 0-9 and a-f after trimming spaces and lowercasing, ask them to copy it again from the website, and meanwhile save without a code and give them that link, so they are never stuck. Students are not technical: never mention tool names, JSON or "MCP"; ask at most 3 short questions at a time, and offer to start without an audit. As soon as they state any preference, build a full-load draft (about 15 credits) that fits it, save it, and say what you assumed; refine with questions after saving, not instead of saving. Pick each discussion or lab from its own lecture's sections (lecture 200 takes a 2xx discussion); save_plan flags mismatches. A backup for a lecture with a discussion or lab needs a matching discussion or lab backup too. When they want a time of day (8 a.m. classes, free afternoons), search with only earliest_start/latest_end first, and never say nothing else meets then unless that search comes back empty. Search each backup with cart = the main schedule minus the section it replaces and avoid_conflicts=true; save_plan flags backups that wouldn't fit. Keep replies under 250 words: the schedule, the class-number paste line, at most 3 assumptions or questions; put the rest in notes. The data has no prerequisites, restrictions or review counts: say "the data doesn't show prerequisites" rather than "no listed prerequisites"; a discussion or lab row's CF numbers are its instructor's. Seat caps come from the tools; don't guess which section fills first. Spring classes end May 4, so spring prerequisites are in progress, not finished, at the McIntire/SDS May 4 deadline. There is no delete tool: if they want their plan deleted, tell them to click Delete plan on the website's Schedule, Cart or Requirements page; for a fresh start, New plan gives a new code and first message; ask before saving an empty cart. For housing, dining or other schools, say Hoos Planner only covers UVA classes, name the right office in one line, and steer back to the schedule. They enroll themselves: if asked to enroll or edit their SIS cart, say you can't and give the 5-digit class numbers to paste into SIS "Add by class number". Pass goals (college, mcintire, sds) for the programs they mention, put alternates in backups (replaces = the main section they would swap in for), and put one or two lines of reasoning in notes, since the site shows them. Call get_planning_rules once per conversation when a question turns on College/McIntire/SDS rules. Quote class numbers and meeting times; say when data is missing (no reviews, TBA, reserve caps, instructor consent).`;
}

/** Snapshot-only instructions (the remote /api/mcp endpoint). */
export const INSTRUCTIONS = buildInstructions();

import { KNOWLEDGE } from "./knowledge";
function loadKnowledge(): string { return KNOWLEDGE; }

const Clock = z.string().max(20).describe("Clock time like '11:00', '2:30pm' or 'noon'");
/** Minutes after midnight; null when it can't be read. A bare 1-7 means afternoon (nobody asks for 2 a.m.). */
export function parseClock(s?: string): number | null | undefined {
  if (!s?.trim()) return undefined;
  const t = s.trim().toLowerCase();
  if (t === "noon") return 12 * 60;
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.[0];
  if (h > 23 || min > 59 || (ap && (h < 1 || h > 12))) return null;
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 7) h += 12;
  return h * 60 + min;
}

/** Loose profile schema: whatever parse_audit returned (or a hand-written subset). */
export function clipProfile(p: Profile): Profile {
  const s = (v: string | undefined, n = 200) => (v === undefined ? undefined : v.slice(0, n));
  return {
    ...p,
    courses: p.courses.slice(0, 200).map((c) => ({ ...c, course: c.course.slice(0, 200), title: s(c.title), term: s(c.term), grade: s(c.grade, 8), source: s(c.source, 40) })),
    tests: p.tests.slice(0, 50).map((t) => ({ ...t, exam: t.exam.slice(0, 200), score: t.score.slice(0, 8), awarded: t.awarded?.slice(0, 10).map((a) => a.slice(0, 200)) })),
    notes: p.notes.slice(0, 50).map((n) => n.slice(0, 200)),
    program: s(p.program), parsedAt: p.parsedAt.slice(0, 40),
  };
}

const uniq = (nbrs: number[]) => [...new Set(nbrs)];

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const clock = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")}${min >= 720 ? "pm" : "am"}`;

function status(catalog: Catalog, profile: Profile, cart: Section[]): RequirementStatus {
  return evaluate({ profile, attrIndex: buildAttrIndex(catalog.sections), acadGroups: buildAcadGroupIndex(catalog.sections), planned: cart, plannedTermName: catalog.term.name });
}

export function statusText(st: RequirementStatus): string {
  const it = (i: { status: string; by?: string }) => `${i.status.replace("_", " ")}${i.by ? ` (${i.by})` : ""}`;
  return [
    `Engagements: ${st.engagements.areas.map((a) => `${a.nbr} ${it(a.item)}`).join("; ")}. Remaining: ${st.engagements.remaining.join(", ") || "none"}.`,
    `First Writing: ${it(st.literacies.fwr)}. Second Writing: ${it(st.literacies.swr)}. World Language: ${it(st.literacies.worldLanguage)}. QCD: ${st.literacies.qcd.courses.length} of 2 (${st.literacies.qcd.courses.map((c) => `${c.course} ${c.status}`).join(", ") || "none"}).`,
    `Disciplines: ${st.disciplines.areas.map((a) => `${a.code} ${it(a.item)}`).join("; ")}. Still owed: ${st.disciplines.unmet.join(", ") || "none"}. Departments used: ${st.disciplines.departments.join(", ") || "none"}.`,
    `Credits: ${st.credits.earned} earned (${st.credits.test} test/transfer), ${st.credits.inProgress} in progress, ${st.credits.planned} in cart → ${st.credits.projected} projected; non-College ${st.credits.nonCollege}/12; graded UVA credits ${st.credits.uvaGraded} now, ${st.credits.uvaGradedProjected} projected.`,
    `McIntire: COMM 1800 ${it(st.mcintire.comm1800)}, ECON 2010 ${it(st.mcintire.econ2010)}, FWR ${it(st.mcintire.fwr)}; ${st.mcintire.ready ? "on track" : "not yet complete"}.`,
    `SDS: DS 1001 ${it(st.sds.ds1001)}, programming ${it(st.sds.programming)}, UVA credits projected ${st.sds.uvaCredits.projected}/24; ${st.sds.ready ? "on track" : "not yet complete"}. ${st.sds.notes.join(" ")}`,
    st.warnings.length ? `Warnings: ${st.warnings.join(" ")}` : "",
    st.engagements.warnings.concat(st.disciplines.warnings).join(" "),
  ].filter(Boolean).join("\n");
}

export function registerPlannerTools(server: McpServer, term = DEFAULT_TERM) {
  const catalog = () => loadCatalog(term);
  const cartSections = (cat: Catalog, nbrs: number[]) => {
    const byNbr = new Map(cat.sections.map((s) => [s.class_nbr, s]));
    return { secs: nbrs.map((n) => byNbr.get(n)).filter((s): s is Section => !!s), missing: nbrs.filter((n) => !byNbr.has(n)) };
  };

  server.registerTool("get_term_info", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Term info",
    description: "Which term the catalog covers, when the SIS snapshot was taken, section count, and the 7-week half dates.",
    inputSchema: z.object({}),
  }, async () => {
    const c = await catalog();
    const t = c.term;
    return text(`${t.name} (SIS term ${t.code}); ${c.sections.length} sections; snapshot ${t.synced_at ?? "seed data"}; classes ${t.start_date} → ${t.end_date}; first half ${t.q_a_start} → ${t.q_a_end}; second half ${t.q_b_start} → ${t.q_b_end}; ${Object.keys(c.ratings).length} courses with Course Forum data.`);
  });

  server.registerTool("get_planning_rules", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Planning rules",
    description: "The College Engagements Pathway rules (Engagements, Literacies, Disciplines, credits), McIntire and SDS prerequisites, and how to rank sections. Call once per conversation when a question depends on the rules.",
    inputSchema: z.object({}),
  }, async () => text(loadKnowledge()));

  server.registerTool("parse_audit", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Parse audit",
    description: "Parse pasted Stellic audit or SIS unofficial-transcript text into a profile (completed / in-progress / transfer / test credit, AP scores, language placement). Returns a summary plus the profile JSON to pass to requirement_status and save_plan. Pass the text exactly as the student pasted it; never summarize or reformat it first.",
    inputSchema: z.object({ text: z.string().min(10).max(40_000).describe("The pasted audit or transcript text") }),
  }, async ({ text: raw }) => {
    const p = clipProfile(parseAudit(raw));
    return text(`${profileSummary(p)}\n${p.notes.join(" ")}\n\nPROFILE_JSON:\n${JSON.stringify(p)}`);
  });

  server.registerTool("search_sections", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Search sections",
    description: "Search the cached term catalog. Returns sections ranked easiest first (Course Forum difficulty, rating, GPA) with class numbers, times, seats, SIS attributes and what each fills for the student when a profile is given. attrs: AIP CMP CSW HP LS SS SES (Disciplines; several = any of them), QCD, SWR (Second Writing), FWR, WL. Pass cart + avoid_conflicts=true to drop collisions.",
    inputSchema: z.object({
      query: z.string().max(200).optional().describe("Free text, a course like 'DS 1002', a subject like 'PHIL', or a 5-digit class number"),
      attrs: z.array(z.string()).optional(),
      engagement: z.enum(["1510", "1520", "1530", "1540"]).optional(),
      quarter: z.enum(["A", "B", "full"]).optional().describe("A = first 7-week half, B = second half"),
      days: z.array(z.enum(["Mo", "Tu", "We", "Th", "Fr"])).optional().describe("Only sections meeting within these days"),
      earliest_start: Clock.optional(), latest_end: Clock.optional(),
      max_difficulty: z.number().optional().describe("Course Forum difficulty ceiling (1 easiest … 5)"),
      min_rating: z.number().optional(),
      college_only: z.boolean().optional(), open_only: z.boolean().optional(),
      include_labs: z.boolean().optional().describe("Include DIS/LAB components"),
      include_unrated: z.boolean().optional().describe("Also return sections whose course has no Course Forum data (blind picks); by default they rank last or are dropped when a difficulty/rating ceiling is set"),
      cart: CartSchema, avoid_conflicts: z.boolean().optional(),
      profile: ProfileSchema.optional(),
      limit: z.number().int().min(1).max(60).default(15),
    }),
  }, async (a) => {
    const es = parseClock(a.earliest_start), le = parseClock(a.latest_end);
    if (es === null || le === null) return text(`Couldn't read the time "${es === null ? a.earliest_start : a.latest_end}". Use a clock time like "10:00", "2:30pm" or "noon".`);
    if (es != null && le != null && le <= es) return text(`latest_end (${a.latest_end}) is not after earliest_start (${a.earliest_start}), so no class could fit. Check the two times.`);
    const cat = await catalog();
    const { secs: cart, missing } = cartSections(cat, uniq(a.cart ?? []));
    const st = a.profile ? status(cat, toProfile(a.profile), cart) : null;
    // Built as a variable (not an inline literal) so the two newest options type-check even before lib/search.ts
    // declares `includeUnrated` / `subjects` on SearchOptions; once it does they are passed through as-is.
    const opts = {
      query: a.query, attrs: a.attrs, engagement: a.engagement, quarter: a.quarter, days: a.days as DayCode[] | undefined,
      earliestStart: es, latestEnd: le, maxDifficulty: a.max_difficulty, minRating: a.min_rating,
      collegeOnly: a.college_only, openOnly: a.open_only,
      components: a.include_labs ? ["LEC", "SEM", "STO", "WKS", "IND", "DIS", "LAB", "PRA"] : undefined,
      avoidConflictsWith: a.avoid_conflicts ? cart : undefined, limit: a.limit,
      includeUnrated: a.include_unrated, subjects: new Set(cat.sections.map((s) => s.subject)),
    };
    const res = searchSections(cat.sections, cat.ratings, cat.term, opts);
    const missingNote = missing.length ? `\nCart class numbers not in the ${cat.term.name} catalog (ignored for conflicts): ${missing.join(", ")}.` : "";
    if (!res.length) return text(`No sections match. Loosen a constraint (earliest start, days, attrs) or check the course code.${missingNote}`);
    const lines = res.map((x) => {
      const fills = st ? ` → ${whatItSatisfies(x.section, st).join("; ")}` : "";
      const isLabRow = isSub(x.section);
      const labs = isLabRow ? [] : companionSections(x.section, cat.sections);
      const labNote = labs.length ? ` (+${labs.length} ${labs[0].component} sections for this lecture, e.g. #${labs.slice(0, 3).map((l) => l.class_nbr).join(", #")})` : "";
      return describeSection(x) + fills + labNote;
    });
    return text(`${res.length} result(s), easiest first (CF = rating/difficulty/GPA):\n${lines.join("\n")}${missingNote}`);
  });

  server.registerTool("check_conflicts", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Check conflicts",
    description: "Check class numbers for time conflicts across days, times and 7-week halves. Returns conflicts, credits, the SIS enroll order (smallest caps first) and a copy-ready class-number list.",
    inputSchema: z.object({ class_nbrs: z.array(z.number().int().min(10000).max(99999)).min(1).max(40) }),
  }, async ({ class_nbrs }) => {
    const cat = await catalog();
    const { secs, missing } = cartSections(cat, uniq(class_nbrs));
    const conflicts = findConflicts(secs);
    const order = enrollOrder(secs);
    return text([
      `Sections (${secs.length}): ${secs.map((s) => `#${s.class_nbr} ${s.course}-${s.class_section} ${s.descr}`).join("; ")}${missing.length ? `. Not in catalog: ${missing.join(", ")}` : ""}`,
      `Credits: ${cartCredits(secs)}${cartCredits(secs) < 12 ? " (below the 12-credit full-time minimum)" : cartCredits(secs) > 18 ? " (over 18 needs the dean)" : ""}`,
      conflicts.length ? `Conflicts:\n${conflicts.map((c) => `- ${c.reason}`).join("\n")}` : "No time conflicts.",
      `Enroll order (scarcest seats first, each discussion/lab right after its lecture): ${order.map((s) => `#${s.class_nbr} ${s.course} ${s.component ?? ""}-${s.class_section} (cap ${s.class_capacity ?? "?"}${s.enrl_stat === "C" ? ", CLOSED" : s.enrl_stat === "W" ? ", waitlist" : ""})`).join(" → ")}`,
      `Paste into SIS "Add by class number": ${order.map((s) => s.class_nbr).join(", ")}`,
    ].join("\n"));
  });

  server.registerTool("requirement_status", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Requirement status",
    description: "Evaluate Engagements, Literacies, Disciplines, credits, McIntire and SDS prerequisites from a profile (from parse_audit) plus the cart. Pass extra_class_nbrs to test a hypothetical addition.",
    inputSchema: z.object({ profile: ProfileSchema, cart: CartSchema, extra_class_nbrs: z.array(z.number().int().min(10000).max(99999)).max(20).optional() }),
  }, async ({ profile, cart, extra_class_nbrs }) => {
    const cat = await catalog();
    const { secs, missing } = cartSections(cat, uniq([...(cart ?? []), ...(extra_class_nbrs ?? [])]));
    const note = missing.length ? `\nClass numbers not in the ${cat.term.name} catalog (not counted): ${missing.join(", ")}.` : "";
    return text(statusText(status(cat, toProfile(profile), secs)) + note);
  });

  server.registerTool("rate_course", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Rate course",
    description: "theCourseForum rating / difficulty / GPA for a course, overall and per instructor, plus which sections each instructor teaches this term.",
    inputSchema: z.object({ course: z.string().max(40).describe("e.g. 'MUSI 2072'") }),
  }, async ({ course: raw }) => {
    const cat = await catalog();
    // "ds1002", "DS  1002" and "DS 1002" all mean the same course
    const course = normCourse(raw);
    if (!course) return text("Give a course code like 'MUSI 2072'.");
    const e = cat.ratings[course];
    const secs = cat.sections.filter((s) => s.course === course);
    if (!e && !secs.length) return text(`No data for ${course}. Check the code with search_sections.`);
    const when = (s: Section) => s.meetings.map((m) => (m.days.length && m.start != null ? `${m.days.join("")} ${clock(m.start)}` : "TBA")).join(" | ") || "TBA";
    const lines: string[] = [e?.overall
      ? `${course} overall: rating ${e.overall.rating ?? "–"}, difficulty ${e.overall.difficulty ?? "–"}, GPA ${e.overall.gpa ?? "–"}`
      : `${course}: no overall Course Forum rating${e ? "; per-instructor ratings below" : ""}.`];
    // Course Forum lists placeholder "instructors" for unassigned sections; they'd match TBA sections by accident
    const real = Object.entries(e?.instructors ?? {}).filter(([n]) => !/\b(announced|staff|tba)\b/i.test(n));
    for (const [name, r] of real) {
      const last = name.split(" ").pop()!.toLowerCase();
      const teaching = secs.filter((s) => (s.instructor_names ?? "").toLowerCase().split(/;\s*/).some((n) => n.split(" ").pop() === last)).map((s) => `#${s.class_nbr}`);
      lines.push(`- ${name}: rating ${r.rating ?? "–"}, difficulty ${r.difficulty ?? "–"}, GPA ${r.gpa ?? "–"}${r.last_term ? (r.last_term === cat.term.name ? `, teaching ${r.last_term}` : `, last taught ${r.last_term}`) : ""}${teaching.length ? `; this term ${teaching.join(", ")}` : ""}`);
    }
    if (secs.length) lines.push(`This term: ${secs.slice(0, 12).map((s) => `#${s.class_nbr} ${s.component}-${s.class_section} ${s.instructor_names ?? "TBA"}, ${when(s)}`).join("; ")}${secs.length > 12 ? ` (+${secs.length - 12} more)` : ""}`);
    return text(lines.join("\n"));
  });

  server.registerTool("save_plan", {
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    title: "Save plan",
    description: "Show the student's plan on the Hoos Planner website, live: Schedule (their week), Cart (every section with SIS details, backups badged) and Requirements (a Stellic-style checklist for the programs in goals; needs the profile). Call it after every change. If the student gave you a plan code from the website, always pass it as code, even on the first save: it creates the plan under that code and the page they have open picks it up. Without a code it creates a new plan; share the returned link once, then keep passing that code. On an update, any field you leave out keeps its saved value (leave out cart to change only backups, notes or goals); a cart you pass replaces the saved cart. Anyone with the code can see and update the plan.",
    inputSchema: z.object({
      cart: z.array(z.number().int().min(10000).max(99999)).max(40).optional().describe("Class numbers of the whole main schedule (replaces the saved one)"),
      backups: BackupsSchema.optional().describe("All backup sections (replaces the saved backups); each needs replaces = the main section it stands in for"),
      goals: GoalsSchema.optional(),
      profile: ProfileSchema.optional(),
      notes: z.string().max(2000).transform(cleanText).optional().describe("One or two sentences for the student on why these sections; shown on the site"),
      code: PlanCode.optional(),
    }),
  }, async ({ profile, cart, backups, goals, notes, code }) => {
    // Fill in whichever list was left out from the saved plan, so a partial update never empties the schedule.
    // Read-merge-write is guarded by updated_at: parallel partial saves (models do call tools in parallel)
    // retry on top of each other instead of one silently undoing the other.
    const partial = !!code && (cart === undefined || backups === undefined);
    let items: PlanCartItem[] = [];
    let res: SaveResult = {};
    for (let attempt = 0; attempt < 4; attempt++) {
      let saved: PlanRow | null = null;
      if (partial) {
        const loaded = await planStore().load(code!);
        if (loaded.error) return text(`Could not save the plan right now (${loaded.error}). Nothing was changed. Try save_plan again in a moment.`);
        saved = loaded.row;
        if (saved && saved.term && saved.term !== term && cart === undefined) {
          return text(`Plan ${code} holds class numbers from SIS term ${saved.term}, but this server serves ${term}. Send the full cart for ${term} (cart=[...]) to replace them.`);
        }
      }
      const savedItems = (saved?.cart as PlanCartItem[] | undefined) ?? null;
      const mainNbrs = cart ?? savedItems?.filter((i) => !i.backup).map((i) => i.class_nbr) ?? [];
      const backupList = backups ?? savedItems?.filter((i) => i.backup).map((i) => ({ class_nbr: i.class_nbr, replaces: i.replaces })) ?? [];
      items = buildCart(mainNbrs, backupList);
      const touchesCart = cart !== undefined || backups !== undefined || !saved;
      res = await planStore().save(code, {
        term: touchesCart || !saved ? term : undefined, cart: touchesCart ? items : undefined,
        profile: profile ? toProfile(profile) : undefined,
        notes, meta: goals ? { goals } : undefined,
      }, { ifUpdatedAt: saved?.updated_at });
      if (!res.conflict) break;
    }
    if (res.conflict) return text("The plan kept changing while saving (another save was running). Call save_plan again with the full cart and backups.");
    if (res.error || !res.code) return text(`Could not save the plan right now (${res.error ?? "unknown error"}). Try save_plan again in a moment; if it keeps failing, give the student the class numbers directly.`);
    const c = res.code;
    const main = items.filter((i) => !i.backup).length, alt = items.length - main;
    const cat = await catalog();
    const { secs, missing } = cartSections(cat, items.map((i) => i.class_nbr));
    const mainSecs = secs.filter((s) => items.some((i) => !i.backup && i.class_nbr === s.class_nbr));
    const pairing = companionProblems(mainSecs, cat.sections);
    // a backup has to fit the week once it takes the place of the section it backs up
    const byNbr = new Map(secs.map((x) => [x.class_nbr, x]));
    const backupClashes = items.filter((i) => i.backup).flatMap((i) => {
      const b = byNbr.get(i.class_nbr);
      if (!b) return [];
      // swapping a section swaps its course's discussion/lab with it, so drop the whole replaced course
      const replacedCourse = mainSecs.find((m) => m.class_nbr === i.replaces)?.course;
      const rest = mainSecs.filter((m) => m.class_nbr !== i.replaces && m.course !== replacedCourse && m.course !== b.course);
      const hit = rest.find((m) => sectionsConflict(b, m));
      return hit ? [`backup #${b.class_nbr} ${b.course}${i.replaces ? ` (for #${i.replaces})` : ""} overlaps #${hit.class_nbr} ${hit.course}`] : [];
    });
    const missingNote = (missing.length ? `\nNot in the ${cat.term.name} catalog, so the site can't show them: ${missing.map((n) => `#${n}`).join(", ")}. Check these numbers with search_sections.` : "")
      + (pairing.length ? `\nFix before the student enrolls (SIS enforces lecture/discussion pairs): ${pairing.join("; ")}. Then save_plan again.` : "")
      + (backupClashes.length ? `\nBackups that wouldn't fit if used: ${backupClashes.join("; ")}. Pick replacements with search_sections using cart = the main schedule minus the section each one replaces and avoid_conflicts=true, then save_plan again.` : "");
    const next = code
      ? `The student's open Hoos Planner pages show this within a few seconds. Tell them it's on their Schedule page${profile ? "" : " (the Requirements page fills in once you save their profile)"}, and keep passing this code.`
      : "Give the student this link: it shows their schedule, cart and requirements, and updates every time you call save_plan with this code.";
    const what = [`${main} section${main === 1 ? "" : "s"}`, alt ? `${alt} backup${alt === 1 ? "" : "s"}` : "", profile ? "with profile" : "", goals?.length ? `goals: ${goals.join(", ")}` : ""].filter(Boolean).join(", ");
    return text(`Saved plan ${c} (${what}).\nLive view: ${planUrl(c)}\n${next} Reload in a new chat with load_plan("${c}"). Anyone with the link can see and update the plan.${missingNote}`);
  });

  server.registerTool("load_plan", {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    title: "Load plan",
    description: "Load a saved plan by code: returns the profile JSON, the cart's class numbers and the current requirement status. Refuses a plan saved for a different SIS term than this server serves.",
    inputSchema: z.object({ code: PlanCode }),
  }, async ({ code }) => {
    const { row: data, error } = await planStore().load(code);
    if (error) return text(`Could not load plan ${code}: ${error}`);
    if (!data) return text(`Nothing is saved under ${code} yet. That is normal for a new code from the website: the first save_plan with this code creates the plan.`);
    if (data.term && data.term !== term) return text(`Plan ${code} was saved for SIS term ${data.term}, but this server serves term ${term}: its class numbers belong to another term and would be misread. Start a fresh plan with save_plan for ${term}.`);
    const cat = await catalog();
    const items = (data.cart as PlanCartItem[]) ?? [];
    const nbrs = items.filter((c) => !c.backup).map((c) => c.class_nbr);
    const backupNote = items.filter((c) => c.backup).map((c) => `#${c.class_nbr}${c.replaces ? ` (for #${c.replaces})` : ""}`).join(", ");
    const goals = (data.meta as { goals?: string[] } | null)?.goals;
    const { secs, missing } = cartSections(cat, nbrs);
    const profile = data.profile ? clipProfile(data.profile as Profile) : null;
    const st = profile ? statusText(status(cat, profile, secs)) : "no profile saved";
    const missingNote = missing.length ? ` (not in the current catalog: ${missing.join(", ")})` : "";
    return text(`Plan ${code} (updated ${data.updated_at}). Live view: ${planUrl(code)}${data.notes ? `\nNotes: ${data.notes}` : ""}\nCart: ${secs.map((s) => `#${s.class_nbr} ${s.course}`).join(", ") || "empty"}${missingNote}${backupNote ? `\nBackups: ${backupNote}` : ""}${goals?.length ? `\nGoals: ${goals.join(", ")}` : ""}\n\nStatus:\n${st}\n\nPROFILE_JSON:\n${JSON.stringify(profile)}`);
  });
}
